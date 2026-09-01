import * as net from 'node:net';
import { startLogSocket, stopLogSocket } from '../src/log-socket';
import { logInfo, setLogBroadcast } from '../src/logger';
import { startStrategyClient, type StrategyClientHandle } from '../src/client';
import { WSSession } from '../src/ws-session';

/**
 * Strategy reframe (2026-09-01): the TCP log mirror and the app-side
 * client module (`startStrategyClient`) that self-hosts the WS channel
 * without CDP.
 */

describe('log socket', () => {
	afterEach(() => {
		stopLogSocket();
		setLogBroadcast(() => {});
	});

	test('broadcasts log lines to connected TCP clients', async () => {
		const port = await startLogSocket(0);
		expect(port).toBeGreaterThan(0);

		const received: string[] = [];
		const socket = net.createConnection(port, '127.0.0.1');
		await new Promise<void>((resolve, reject) => {
			socket.once('connect', () => resolve());
			socket.once('error', reject);
		});
		socket.on('data', (data) => {
			received.push(String(data));
		});

		logInfo('socket-test-marker');
		await new Promise((resolve) => setTimeout(resolve, 200));

		const all = received.join('');
		expect(all).toContain('socket-test-marker');

		socket.destroy();
	});

	test('logger still works with no socket started', () => {
		// broadcast is a no-op here; this must simply not throw
		expect(() => logInfo('no-socket-marker')).not.toThrow();
	});
});

describe('startStrategyClient (app-side self-hosted channel)', () => {
	let handle: StrategyClientHandle | null = null;

	afterEach(async () => {
		if (handle) {
			await handle.stop();
			handle = null;
		}
	});

	test('starts the WS channel in-process and answers ping', async () => {
		handle = await startStrategyClient();
		expect(handle.port).toBeGreaterThan(0);
		expect(handle.token).toBeTruthy();
		expect(handle.pid).toBe(process.pid);
		expect(handle.alreadyRunning).toBe(false);

		const session = await WSSession.connect('127.0.0.1', handle.port, handle.token);
		expect(session.isOpen).toBe(true);
		const pong = await session.request('ping');
		expect(pong).toMatchObject({ pong: true });
		session.close();
	});

	test('rejects a bad token at the handshake', async () => {
		handle = await startStrategyClient();
		await expect(
			WSSession.connect('127.0.0.1', handle.port, 'wrong-token')
		).rejects.toThrow();
	});

	test('is idempotent — a second start reports alreadyRunning', async () => {
		handle = await startStrategyClient();
		const second = await startStrategyClient();
		expect(second.alreadyRunning).toBe(true);
		expect(second.port).toBe(handle.port);
	});

	test('stop() closes the channel', async () => {
		handle = await startStrategyClient();
		const port = handle.port;
		await handle.stop();
		handle = null;
		await expect(
			WSSession.connect('127.0.0.1', port, 'whatever')
		).rejects.toThrow();
	});
});
