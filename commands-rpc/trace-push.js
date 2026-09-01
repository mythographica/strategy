/**
 * MCP Tool Metadata:
 * {
 *   "name": "rpc_trace_push",
 *   "description": "Push channel: the target's own dive hooks (enter/create via traceSubscribe on the in-target WS) drive trace edges to mnemographica — no CDP polling. Requires ws_bootstrap first. getTrace/dive-trace stay for exact queries.",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "action": {
 *         "type": "string",
 *         "enum": ["start", "stop", "status"],
 *         "description": "Push control (default: status)"
 *       },
 *       "url": {
 *         "type": "string",
 *         "description": "Mnemographica WS endpoint (default: ws://127.0.0.1:9231)"
 *       },
 *       "source": {
 *         "type": "string",
 *         "description": "Label attached to each ingest batch (default: 'rpc_trace_push')"
 *       },
 *       "events": {
 *         "type": "array",
 *         "items": { "type": "string" },
 *         "description": "dive hook events to subscribe in-target (default: ['enter', 'create', 'leave', 'settle'])"
 *       },
 *       "flushMs": {
 *         "type": "number",
 *         "description": "In-target flush interval in milliseconds (default: 150, min 20)"
 *       }
 *     }
 *   },
 *   "examples": [
 *     {
 *       "description": "Start pushing dive trace edges to mnemographica",
 *       "args": { "action": "start" }
 *     },
 *     {
 *       "description": "Check push counters",
 *       "args": { "action": "status" }
 *     },
 *     {
 *       "description": "Stop the push channel",
 *       "args": { "action": "stop" }
 *     }
 *   ]
 * }
 */

// Sibling of trace-stream.js: same mnemographica forwarding (trace/ingest
// with ack), but the source is PUSH — dive hook notifications arriving over
// the in-target WS channel (cdp-scripts/ws-server.js traceSubscribe op)
// instead of a CDP polling interval. State lives in the global store under
// 'tracePush' so it survives across MCP calls.

function statusOf (state) {
	if (!state) {
		return { success: true, running: false };
	}
	return {
		success         : true,
		running         : state.running,
		events          : state.events,
		batchesReceived : state.batchesReceived,
		edgesReceived   : state.edgesReceived,
		pushedTotal     : state.pushedTotal,
		lastError       : state.lastError,
		url             : state.url,
		source          : state.source
	};
}

function stopPush (store, state, reason) {
	if (!state) {
		return { success: true, running: false, note: 'not running' };
	}
	state.running = false;
	if (reason) {
		state.lastError = reason;
	}
	// Detach the notification handler and unsubscribe in-target; reject ack
	// waiters so a forward never hangs on a dead socket
	const session = state.session;
	if (session) {
		try {
			session.setNotificationHandler('trace', null);
			if (session.isOpen) {
				session.request('traceUnsubscribe').catch(() => {});
			}
		} catch (e) {}
	}
	for (const pending of state.pending.values()) {
		clearTimeout(pending.timer);
		pending.resolve(null);
	}
	state.pending.clear();
	try {
		if (state.ws) {
			state.ws.close();
		}
	} catch (e) {}
	const finalStatus = statusOf(state);
	return finalStatus;
}

// Notification batches can arrive faster than mnemographica acks — forwards
// are chained on state.tail so ingests keep arrival order.
async function forwardEdges (state, edges) {
	state.batchesReceived++;
	state.edgesReceived += edges.length;
	const msgId = state.nextId++;
	const send = async () => {
		const ack = await new Promise((resolve) => {
			const timer = setTimeout(() => {
				state.pending.delete(msgId);
				resolve(null);
			}, 5000);
			state.pending.set(msgId, { resolve, timer });
			state.ws.send(JSON.stringify({
				jsonrpc : '2.0',
				id      : msgId,
				method  : 'trace/ingest',
				params  : { edges, source: state.source, session: state.sourceSession }
			}));
		});
		if (!ack || ack.error) {
			stopPush(state.storeRef, state, 'ingest ack failed: ' + JSON.stringify(ack && ack.error || 'timeout'));
			return;
		}
		const acked = ack.result || {};
		state.pushedTotal += typeof acked.accepted === 'number' ? acked.accepted : edges.length;
	};
	state.tail = state.tail.then(send, send);
}

async function startPush (ctx, commandArgs, existing) {
	const store = ctx.store;
	const require = ctx.require;

	if (existing && existing.running) {
		const status = statusOf(existing);
		status.note = 'already running';
		return status;
	}

	const channel = (store && store instanceof Map) ? store.get('ws') : null;
	const session = channel && channel.session;
	if (!session || !session.isOpen) {
		return { success: false, error: 'No WS channel — run ws_bootstrap first' };
	}

	const url = commandArgs.url || 'ws://127.0.0.1:9231';
	const source = commandArgs.source || 'rpc_trace_push';

	// Subscribe in-target FIRST: if the target's dive cannot serve the
	// requested events, nothing local is set up at all.
	const subParams = {};
	if (Array.isArray(commandArgs.events)) {
		subParams.events = commandArgs.events;
	}
	if (typeof commandArgs.flushMs === 'number') {
		subParams.flushMs = commandArgs.flushMs;
	}
	let subscription;
	try {
		subscription = await session.request('traceSubscribe', subParams);
	} catch (e) {
		return { success: false, error: 'traceSubscribe failed: ' + e.message };
	}

	const WebSocket = require('ws');
	const ws = new WebSocket(url);
	try {
		await new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('connect timeout')), 5000);
			ws.once('open', () => { clearTimeout(timer); resolve(); });
			ws.once('error', (err) => { clearTimeout(timer); reject(err); });
		});
	} catch (e) {
		try {
			await session.request('traceUnsubscribe');
		} catch (e2) {}
		return { success: false, error: 'cannot reach mnemographica at ' + url + ': ' + e.message };
	}

	const state = {
		running         : true,
		session,
		ws,
		// Source session marker: the target's pid, so mnemographica can
		// auto-wipe when the target restarts (VACUUM rule, 2026-08-30)
		sourceSession   : typeof channel.pid === 'number' ? 'pid-' + channel.pid : undefined,
		events          : (subscription && subscription.events) || [],
		batchesReceived : 0,
		edgesReceived   : 0,
		pushedTotal     : 0,
		lastError       : null,
		url,
		source,
		nextId          : 1,
		pending         : new Map(),
		tail            : Promise.resolve(),
		storeRef        : store
	};

	session.setNotificationHandler('trace', (params) => {
		const edges = params && Array.isArray(params.edges) ? params.edges : null;
		if (!state.running || !edges || edges.length === 0) {
			return;
		}
		forwardEdges(state, edges);
	});

	ws.on('message', (raw) => {
		let msg;
		try {
			msg = JSON.parse(raw.toString());
		} catch (e) {
			return;
		}
		const pending = state.pending.get(msg.id);
		if (pending) {
			state.pending.delete(msg.id);
			clearTimeout(pending.timer);
			pending.resolve(msg);
		}
	});
	ws.on('close', () => {
		if (state.running) {
			stopPush(store, state, 'mnemographica WS closed');
		}
	});
	ws.on('error', (err) => {
		if (state.running) {
			stopPush(store, state, 'mnemographica WS error: ' + err.message);
		}
	});

	store.set('tracePush', state);

	const status = statusOf(state);
	status.started = true;
	if (subscription && Array.isArray(subscription.unsupported) && subscription.unsupported.length > 0) {
		status.unsupported = subscription.unsupported;
	}
	return status;
}

async function run (ctx) {
	const store = ctx.store;
	const args = ctx.args || {};

	let commandArgs = args;
	if (args.message && typeof args.message === 'string') {
		try {
			commandArgs = JSON.parse(args.message);
		} catch (e) {}
	}

	const action = commandArgs.action || 'status';
	const state = (store && store instanceof Map) ? store.get('tracePush') : null;

	if (action === 'status') {
		return statusOf(state);
	}
	if (action === 'stop') {
		return stopPush(store, state);
	}
	if (action === 'start') {
		return startPush(ctx, commandArgs, state);
	}
	return { success: false, error: 'unknown action: ' + action };
}

module.exports = { run };
