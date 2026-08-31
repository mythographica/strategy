/**
 * MCP Tool Metadata:
 * {
 *   "name": "rpc_jaeger_trace",
 *   "description": "Postmortem trace replay: query Jaeger's HTTP API for spans carrying dive edge identity (dive.edge_id / dive.kind / dive.name — exported by DiveOtelProvider), join span names to AOT graph nodes via mnemographica's state/query, and replay the branch into the panel through trace/ingest under a 'jaeger:<traceID>' session. Bulbs flash for a trace that already happened — the Jaeger companion of the live push channel.",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "action": {
 *         "type": "string",
 *         "enum": ["list", "replay"],
 *         "description": "list = recent traces with dive spans; replay = push one trace into mnemographica (default: list)"
 *       },
 *       "traceID": {
 *         "type": "string",
 *         "description": "Jaeger trace ID to replay (default: latest trace containing dive spans)"
 *       },
 *       "service": {
 *         "type": "string",
 *         "description": "Jaeger service name (default: tactica-nestjs)"
 *       },
 *       "jaegerUrl": {
 *         "type": "string",
 *         "description": "Jaeger query endpoint (default: http://localhost:16686)"
 *       },
 *       "url": {
 *         "type": "string",
 *         "description": "Mnemographica WS endpoint (default: ws://127.0.0.1:9231)"
 *       },
 *       "limit": {
 *         "type": "number",
 *         "description": "How many recent traces to scan (default: 20)"
 *       }
 *     }
 *   },
 *   "examples": [
 *     {
 *       "description": "List recent traces that contain dive spans",
 *       "args": { "action": "list" }
 *     },
 *     {
 *       "description": "Replay the latest dive-bearing trace into the 3D panel",
 *       "args": { "action": "replay" }
 *     }
 *   ]
 * }
 */

// The live channel (trace-stream / trace-push) illuminates NOW; this
// command illuminates THEN — Jaeger retains what the ring buffer evicted,
// and the dive.* tags survive the OTLP round-trip unchanged.

function tagValue (span, key) {
	const tag = (span.tags || []).find((t) => t.key === key);
	const result = tag ? tag.value : undefined;
	return result;
}

function spanToEdge (span, edgeIdBySpanId) {
	const edgeId = tagValue(span, 'dive.edge_id');
	if (edgeId === undefined) {
		return null;
	}
	let parentId = null;
	const ref = (span.references || []).find((r) => r.refType === 'CHILD_OF');
	if (ref) {
		const parentEdgeId = edgeIdBySpanId.get(ref.spanID);
		if (parentEdgeId !== undefined) {
			parentId = parentEdgeId;
		}
	}
	const durationMs = tagValue(span, 'dive.duration_ms');
	const edge = {
		id           : edgeId,
		parentId,
		name         : tagValue(span, 'dive.name') || span.operationName,
		kind         : tagValue(span, 'dive.kind') || 'call',
		status       : tagValue(span, 'dive.status') || 'ok',
		duration     : durationMs !== undefined ? durationMs : Math.round(span.duration / 1000),
		ts           : Math.round(span.startTime / 1000),
		instanceType : tagValue(span, 'dive.kind') === 'create' ? tagValue(span, 'dive.name') : undefined
	};
	return edge;
}

async function fetchJson (url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error('jaeger HTTP ' + response.status + ' for ' + url);
	}
	const result = await response.json();
	return result;
}

async function queryGraphNodes (url) {
	const WebSocket = require('ws');
	const ws = new WebSocket(url);
	await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
	const answer = await new Promise((resolve, reject) => {
		ws.on('message', (raw) => {
			const msg = JSON.parse(raw.toString());
			if (msg.id === 42) { resolve(msg); }
		});
		ws.send(JSON.stringify({ jsonrpc: '2.0', id: 42, method: 'state/query', params: { subject: 'graph' } }));
		setTimeout(() => reject(new Error('state/query timeout')), 8000);
	});
	ws.close();
	const nodes = (answer.result && answer.result.nodes) || [];
	const result = new Set();
	for (const n of nodes) {
		result.add(n.id);
		result.add(n.name);
	}
	return result;
}

function ingestBatch (url, edges, session) {
	const WebSocket = require('ws');
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(url);
		const timer = setTimeout(() => { ws.close(); reject(new Error('ingest ack timeout')); }, 8000);
		ws.on('open', () => {
			ws.send(JSON.stringify({
				jsonrpc : '2.0',
				id      : 42,
				method  : 'trace/ingest',
				params  : { edges, session }
			}));
		});
		ws.on('message', (raw) => {
			const msg = JSON.parse(raw.toString());
			if (msg.id === 42) {
				clearTimeout(timer);
				ws.close();
				resolve(msg.result);
			}
		});
		ws.on('error', (e) => { clearTimeout(timer); reject(e); });
	});
}

async function run (ctx) {
	const args = ctx.args || {};
	let commandArgs = args;
	if (args.message && typeof args.message === 'string') {
		try {
			commandArgs = JSON.parse(args.message);
		} catch (e) {}
	}

	const action = commandArgs.action || 'list';
	const service = commandArgs.service || 'tactica-nestjs';
	const jaegerUrl = commandArgs.jaegerUrl || 'http://localhost:16686';
	const limit = commandArgs.limit || 20;

	let traces;
	try {
		const answer = await fetchJson(`${jaegerUrl}/api/traces?service=${encodeURIComponent(service)}&limit=${limit}`);
		traces = answer.data || [];
	} catch (e) {
		return { success: false, error: 'cannot reach jaeger at ' + jaegerUrl + ': ' + e.message };
	}

	// Keep only traces that carry at least one dive span
	const diveTraces = traces.map((trace) => {
		const diveSpans = trace.spans.filter((s) => tagValue(s, 'dive.edge_id') !== undefined);
		const summary = {
			traceID   : trace.traceID,
			spans     : trace.spans.length,
			diveSpans : diveSpans.length,
			names     : diveSpans.map((s) => tagValue(s, 'dive.name'))
		};
		return summary;
	}).filter((t) => t.diveSpans > 0);

	if (action === 'list') {
		return { success: true, traces: diveTraces, scanned: traces.length };
	}

	if (action !== 'replay') {
		return { success: false, error: 'unknown action: ' + action };
	}

	// Replay: with a traceID, that one trace; without, the whole scanned
	// window — constructions and wrapped calls land in SEPARATE jaeger
	// traces (see the create-hook note in the fixture's tracing.ts), so a
	// single traceID never shows the full story on its own.
	const wantedId = commandArgs.traceID;
	const selected = wantedId
		? traces.filter((t) => t.traceID === wantedId)
		: traces.filter((t) => t.spans.some((s) => tagValue(s, 'dive.edge_id') !== undefined));
	if (selected.length === 0) {
		const reason = wantedId
			? 'trace ' + wantedId + ' not in the scanned window (limit ' + limit + ')'
			: 'no dive-bearing traces found for service ' + service;
		return { success: false, error: reason };
	}

	const allSpans = selected.flatMap((t) => t.spans);
	const edgeIdBySpanId = new Map();
	for (const span of allSpans) {
		const edgeId = tagValue(span, 'dive.edge_id');
		if (edgeId !== undefined) {
			edgeIdBySpanId.set(span.spanID, edgeId);
		}
	}
	const edges = allSpans
		.map((s) => spanToEdge(s, edgeIdBySpanId))
		.filter((e) => e !== null)
		.sort((a, b) => a.ts - b.ts);

	if (edges.length === 0) {
		return { success: false, error: 'selected traces carry no dive spans' };
	}

	// Join span names to AOT graph nodes (state/query over the WS)
	const url = commandArgs.url || 'ws://127.0.0.1:9231';
	let nodeNames;
	try {
		nodeNames = await queryGraphNodes(url);
	} catch (e) {
		return { success: false, error: 'cannot reach mnemographica at ' + url + ': ' + e.message };
	}
	const matched = [...new Set(edges.map((e) => e.name).filter((n) => nodeNames.has(n)))];
	const unmatched = [...new Set(edges.map((e) => e.name).filter((n) => !nodeNames.has(n)))];

	// A fresh session per replay: replaying the same window would resend
	// the same dive edge ids and ingest's monotonic dedup would drop them
	// all. The session switch wipes the panel's trace buffer (the VACUUM
	// semantics) — right for postmortem inspection: one replay, one story.
	const session = 'jaeger:' + (wantedId || 'window') + ':' + Date.now();
	const ingest = await ingestBatch(url, edges, session);

	const result = {
		success  : true,
		traceID  : wantedId || null,
		traces   : selected.map((t) => t.traceID),
		session,
		edges    : edges.length,
		matched,
		unmatched,
		ingest
	};
	return result;
}

module.exports = { run };
