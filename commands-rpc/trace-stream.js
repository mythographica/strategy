/**
 * MCP Tool Metadata:
 * {
 *   "name": "rpc_trace_stream",
 *   "description": "Stream dive-trace deltas from the CDP-connected target into mnemographica's WS channel (trace/ingest on :9231). Polls rpc_dive_trace with a monotonic sinceId and pushes each batch; ambient 'server is alive' illumination for the 3D panel (B1.4).",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "action": {
 *         "type": "string",
 *         "enum": ["start", "stop", "status"],
 *         "description": "Stream control (default: status)"
 *       },
 *       "intervalMs": {
 *         "type": "number",
 *         "description": "Poll interval in milliseconds (default: 1000)"
 *       },
 *       "url": {
 *         "type": "string",
 *         "description": "Mnemographica WS endpoint (default: ws://127.0.0.1:9231)"
 *       },
 *       "source": {
 *         "type": "string",
 *         "description": "Label attached to each ingest batch (default: 'rpc_trace_stream')"
 *       }
 *     }
 *   },
 *   "examples": [
 *     {
 *       "description": "Start streaming trace deltas to mnemographica every second",
 *       "args": { "action": "start" }
 *     },
 *     {
 *       "description": "Check stream counters",
 *       "args": { "action": "status" }
 *     },
 *     {
 *       "description": "Stop the stream",
 *       "args": { "action": "stop" }
 *     }
 *   ]
 * }
 */

// Stream state lives in the global store under 'traceStream' so it
// survives across MCP calls (start returns immediately; the interval
// keeps polling in the server process).

function statusOf (state) {
	if (!state) {
		return { success: true, running: false };
	}
	return {
		success     : true,
		running     : state.running,
		lastId      : state.lastId,
		pushedTotal : state.pushedTotal,
		ticks       : state.ticks,
		lastError   : state.lastError,
		url         : state.url,
		intervalMs  : state.intervalMs,
		source      : state.source
	};
}

function stopStream (store, state, reason) {
	if (!state) {
		return { success: true, running: false, note: 'not running' };
	}
	if (state.timer) {
		clearInterval(state.timer);
		state.timer = null;
	}
	state.running = false;
	if (reason) {
		state.lastError = reason;
	}
	// Reject any ack waiters so a tick never hangs on a dead socket
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

async function tick (ctx, state) {
	if (state.busy) { return; }
	state.busy = true;
	try {
		// Lazy sibling require, absolute path — ctx.require is anchored
		// at strategy's lib/, so a relative './dive-trace.js' would
		// resolve to the wrong tree. Tests inject a fake module by
		// intercepting this exact path suffix in ctx.require.
		const diveTrace = ctx.require(__dirname + '/dive-trace.js');
		const pollCtx = Object.assign({}, ctx, { args: { sinceId: state.lastId } });
		const res = await diveTrace.run(pollCtx);
		const payload = res && res.result;
		if (!res || !res.success || !payload || payload.success === false) {
			state.lastError = (payload && payload.error) || (res && res.error) || 'dive-trace poll failed';
			state.ticks++;
			return;
		}
		const edges = Array.isArray(payload.edges) ? payload.edges : [];
		if (edges.length > 0) {
			const msgId = state.nextId++;
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
					params  : { edges, source: state.source }
				}));
			});
			if (!ack || ack.error) {
				stopStream(state.storeRef, state, 'ingest ack failed: ' + JSON.stringify(ack && ack.error || 'timeout'));
				return;
			}
			const acked = ack.result || {};
			state.lastId = typeof acked.lastId === 'number'
				? acked.lastId
				: Math.max.apply(null, edges.map((edge) => edge.id || 0));
			state.pushedTotal += typeof acked.accepted === 'number' ? acked.accepted : edges.length;
		}
		state.ticks++;
	} catch (e) {
		state.lastError = e.message;
	} finally {
		state.busy = false;
	}
}

async function startStream (ctx, commandArgs, existing) {
	const store = ctx.store;
	const require = ctx.require;

	if (existing && existing.running) {
		const status = statusOf(existing);
		status.note = 'already running';
		return status;
	}

	const cdpData = (store && store instanceof Map) ? store.get('cdp') : null;
	if (!cdpData || !cdpData.isConnected) {
		return { success: false, error: 'No CDP connection — rpc_connection connect first' };
	}

	const url = commandArgs.url || 'ws://127.0.0.1:9231';
	const intervalMs = typeof commandArgs.intervalMs === 'number' ? commandArgs.intervalMs : 1000;
	const source = commandArgs.source || 'rpc_trace_stream';

	const WebSocket = require('ws');
	const ws = new WebSocket(url);
	try {
		await new Promise((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error('connect timeout')), 5000);
			ws.once('open', () => { clearTimeout(timer); resolve(); });
			ws.once('error', (err) => { clearTimeout(timer); reject(err); });
		});
	} catch (e) {
		return { success: false, error: 'cannot reach mnemographica at ' + url + ': ' + e.message };
	}

	const state = {
		running     : true,
		ws,
		timer       : null,
		lastId      : 0,
		pushedTotal : 0,
		ticks       : 0,
		lastError   : null,
		url,
		intervalMs,
		source,
		nextId      : 1,
		pending     : new Map(),
		busy        : false,
		storeRef    : store
	};

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
			stopStream(store, state, 'mnemographica WS closed');
		}
	});
	ws.on('error', (err) => {
		if (state.running) {
			stopStream(store, state, 'mnemographica WS error: ' + err.message);
		}
	});

	store.set('traceStream', state);
	state.timer = setInterval(() => { tick(ctx, state); }, intervalMs);
	// First poll immediately — no reason to wait a full interval
	tick(ctx, state);

	const status = statusOf(state);
	status.started = true;
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
	const state = (store && store instanceof Map) ? store.get('traceStream') : null;

	if (action === 'status') {
		return statusOf(state);
	}
	if (action === 'stop') {
		return stopStream(store, state);
	}
	if (action === 'start') {
		return startStream(ctx, commandArgs, state);
	}
	return { success: false, error: 'unknown action: ' + action };
}

module.exports = { run };
