import * as path from 'path';
import { AddressInfo } from 'net';
import WebSocket from 'ws';

/**
 * rpc_trace_push behavior suite: a fake WSSession plays the in-target
 * channel (traceSubscribe/traceUnsubscribe requests, a captured 'trace'
 * notification handler), a real WS server plays mnemographica (trace/ingest
 * acks). No real CDP target or dive needed: the command only checks
 * store['ws'].session.isOpen.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const tracePush = require('../commands-rpc/trace-push.js');

type FakeEdge = { id: number; name: string };

interface FakeSession {
	isOpen: boolean;
	requests: Array<{ op: string; params: unknown }>;
	traceHandler: ((params: unknown) => void) | null;
	request: (op: string, params?: unknown) => Promise<unknown>;
	setNotificationHandler: (op: string, handler: ((params: unknown) => void) | null) => void;
}

function makeSession (overrides: Partial<FakeSession> = {}): FakeSession {
	const session: FakeSession = {
		isOpen        : true,
		requests      : [],
		traceHandler  : null,
		request       : async (op: string, params?: unknown) => {
			session.requests.push({ op, params });
			if (op === 'traceSubscribe') {
				return { subscribed: true, events: ['enter', 'create'] };
			}
			return {};
		},
		setNotificationHandler : (op, handler) => {
			if (op === 'trace') {
				session.traceHandler = handler;
			}
		},
	};
	return Object.assign(session, overrides);
}

function makeCtx (store: Map<string | symbol, unknown>, args: Record<string, unknown> = {}) {
	const ctx = {
		require : require,
		store,
		args
	};
	return ctx;
}

describe('rpc_trace_push', () => {
	let wsServer: WebSocket.Server;
	let received: Array<{ edges: FakeEdge[]; source: string; session?: string }>;
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
		const result = await tracePush.run(makeCtx(store));
		expect(result.success).toBe(true);
		expect(result.running).toBe(false);
	});

	test('start without a WS channel fails fast', async () => {
		const store = new Map<string | symbol, unknown>();
		const result = await tracePush.run(makeCtx(store, { action: 'start', url: wsUrl }));
		expect(result.success).toBe(false);
		expect(result.error).toMatch(/No WS channel/);
	});

	test('start subscribes in-target; notifications forward in arrival order', async () => {
		const store = new Map<string | symbol, unknown>();
		const session = makeSession();
		store.set('ws', { session, pid: 1234 });
		const ctx = makeCtx(store);

		const started = await tracePush.run(makeCtx(store, { action: 'start', url: wsUrl, source: 'jest' }));
		expect(started.success).toBe(true);
		expect(started.running).toBe(true);
		expect(started.events).toEqual(['enter', 'create']);
		expect(session.requests.map((r) => r.op)).toEqual(['traceSubscribe']);
		expect(session.traceHandler).not.toBeNull();

		session.traceHandler!({ edges: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] });
		session.traceHandler!({ edges: [{ id: 3, name: 'c' }] });

		await new Promise((resolve) => setTimeout(resolve, 150));

		expect(received.length).toBe(2);
		expect(received[0].edges.map((edge) => edge.id)).toEqual([1, 2]);
		expect(received[1].edges.map((edge) => edge.id)).toEqual([3]);
		expect(received[0].source).toBe('jest');
		// VACUUM rule: the target's pid rides every batch as the session
		// marker, so mnemographica auto-wipes on a source restart
		expect(received[0].session).toBe('pid-1234');
		expect(received[1].session).toBe('pid-1234');

		const status = await tracePush.run(makeCtx(store, { action: 'status' }));
		expect(status.batchesReceived).toBe(2);
		expect(status.edgesReceived).toBe(3);
		expect(status.pushedTotal).toBe(3);

		const stopped = await tracePush.run(makeCtx(store, { action: 'stop' }));
		expect(stopped.running).toBe(false);
		expect(session.traceHandler).toBeNull();
		expect(session.requests.map((r) => r.op)).toEqual(['traceSubscribe', 'traceUnsubscribe']);
	});

	test('a failed traceSubscribe sets nothing up', async () => {
		const store = new Map<string | symbol, unknown>();
		const session = makeSession({
			request : async (op: string) => {
				if (op === 'traceSubscribe') {
					throw new Error('target runtime has no @mnemonica/dive registerHook');
				}
				return {};
			}
		});
		store.set('ws', { session });

		const result = await tracePush.run(makeCtx(store, { action: 'start', url: wsUrl }));
		expect(result.success).toBe(false);
		expect(result.error).toMatch(/traceSubscribe failed/);
		expect(session.traceHandler).toBeNull();
		expect(store.get('tracePush')).toBeUndefined();
	});

	test('unreachable mnemographica unsubscribes in-target and fails clean', async () => {
		const store = new Map<string | symbol, unknown>();
		const session = makeSession();
		store.set('ws', { session });

		const result = await tracePush.run(makeCtx(store, {
			action : 'start',
			url    : 'ws://127.0.0.1:1'
		}));
		expect(result.success).toBe(false);
		expect(result.error).toMatch(/cannot reach mnemographica/);
		expect(session.requests.map((r) => r.op)).toEqual(['traceSubscribe', 'traceUnsubscribe']);
	});

	test('double start reports already running', async () => {
		const store = new Map<string | symbol, unknown>();
		store.set('ws', { session: makeSession() });
		await tracePush.run(makeCtx(store, { action: 'start', url: wsUrl }));
		const again = await tracePush.run(makeCtx(store, { action: 'start', url: wsUrl }));
		expect(again.note).toBe('already running');
		await tracePush.run(makeCtx(store, { action: 'stop' }));
	});
});
