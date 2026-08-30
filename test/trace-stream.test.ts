import * as path from 'path';
import { AddressInfo } from 'net';
import WebSocket from 'ws';

/**
 * rpc_trace_stream behavior suite: a real WS server plays mnemographica
 * (trace/ingest acks), a fake dive-trace module plays the CDP poller
 * (injected through ctx.require — the command requires the sibling by
 * absolute path, so intercepting the path suffix is enough). No real
 * CDP target needed: the stream only checks store['cdp'].isConnected.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const traceStream = require('../commands-rpc/trace-stream.js');

type FakeEdge = { id: number; name: string };

function makeCtx (store: Map<string | symbol, unknown>, edgesPerPoll: FakeEdge[][]) {
	let pollIndex = 0;
	const realRequire = require;
	const fakeRequire = (id: string) => {
		if (id.endsWith('dive-trace.js')) {
			return {
				run: async () => {
					const edges = edgesPerPoll[pollIndex] || [];
					pollIndex++;
					return {
						success : true,
						result  : { success: true, edgeCount: edges.length, edges }
					};
				}
			};
		}
		return realRequire(id);
	};
	const ctx = {
		require : fakeRequire,
		store,
		args    : {}
	};
	return ctx;
}

describe('rpc_trace_stream', () => {
	let wsServer: WebSocket.Server;
	let received: Array<{ edges: FakeEdge[]; source: string }>;
	let wsUrl: string;

	beforeEach(async () => {
		received = [];
		wsServer = new WebSocket.Server({ port: 0, host: '127.0.0.1' });
		await new Promise<void>((resolve) => wsServer.on('listening', resolve));
		const { port } = wsServer.address() as AddressInfo;
		wsUrl = `ws://127.0.0.1:${port}`;
		wsServer.on('connection', (socket) => {
			socket.on('message', (raw) => {
				const msg = JSON.parse(raw.toString());
				if (msg.method === 'trace/ingest') {
					received.push(msg.params);
					const lastId = Math.max(...msg.params.edges.map((edge: FakeEdge) => edge.id));
					socket.send(JSON.stringify({
						jsonrpc : '2.0',
						id      : msg.id,
						result  : { accepted: msg.params.edges.length, lastId, buffered: lastId }
					}));
				}
			});
		});
	});

	afterEach(async () => {
		wsServer.close();
	});

	test('status before any start reports not running', async () => {
		const store = new Map<string | symbol, unknown>();
		const ctx = makeCtx(store, []);
		const result = await traceStream.run(ctx);
		expect(result.success).toBe(true);
		expect(result.running).toBe(false);
	});

	test('start without a CDP connection fails fast', async () => {
		const store = new Map<string | symbol, unknown>();
		const ctx = makeCtx(store, []);
		const result = await traceStream.run(Object.assign({}, ctx, { args: { action: 'start', url: wsUrl } }));
		expect(result.success).toBe(false);
		expect(result.error).toMatch(/No CDP connection/);
	});

	test('start polls and pushes deltas, sinceId advances from acks', async () => {
		const store = new Map<string | symbol, unknown>();
		store.set('cdp', { isConnected: true });
		const polls = [
			[{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
			[],
			[{ id: 3, name: 'c' }],
		];
		const ctx = makeCtx(store, polls);
		const started = await traceStream.run(Object.assign({}, ctx, {
			args : { action: 'start', url: wsUrl, intervalMs: 30, source: 'jest' }
		}));
		expect(started.success).toBe(true);
		expect(started.running).toBe(true);

		// let several ticks run
		await new Promise((resolve) => setTimeout(resolve, 250));

		const status = await traceStream.run(Object.assign({}, ctx, { args: { action: 'status' } }));
		expect(status.lastId).toBe(3);
		expect(status.pushedTotal).toBe(3);
		expect(status.ticks).toBeGreaterThanOrEqual(3);
		expect(received.length).toBe(2);
		expect(received[0].edges.map((edge) => edge.id)).toEqual([1, 2]);
		expect(received[1].edges.map((edge) => edge.id)).toEqual([3]);
		expect(received[0].source).toBe('jest');

		const stopped = await traceStream.run(Object.assign({}, ctx, { args: { action: 'stop' } }));
		expect(stopped.running).toBe(false);
		expect(stopped.pushedTotal).toBe(3);
	});

	test('double start reports already running', async () => {
		const store = new Map<string | symbol, unknown>();
		store.set('cdp', { isConnected: true });
		const ctx = makeCtx(store, [[]]);
		await traceStream.run(Object.assign({}, ctx, {
			args : { action: 'start', url: wsUrl, intervalMs: 1000 }
		}));
		const again = await traceStream.run(Object.assign({}, ctx, {
			args : { action: 'start', url: wsUrl, intervalMs: 1000 }
		}));
		expect(again.note).toBe('already running');
		await traceStream.run(Object.assign({}, ctx, { args: { action: 'stop' } }));
	});

	test('start fails cleanly when mnemographica is unreachable', async () => {
		const store = new Map<string | symbol, unknown>();
		store.set('cdp', { isConnected: true });
		const ctx = makeCtx(store, []);
		const result = await traceStream.run(Object.assign({}, ctx, {
			args : { action: 'start', url: 'ws://127.0.0.1:1', intervalMs: 30 }
		}));
		expect(result.success).toBe(false);
		expect(result.error).toMatch(/cannot reach mnemographica/);
	});
});
