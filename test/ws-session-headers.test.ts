// ws-session header pin (reload-to-dev C2): connect() can carry extra
// upgrade headers — the infer-debug trigger header is what makes infer-debug
// relay the upgrade to the debug child instead of the main process.
import { WebSocketServer } from 'ws';
import type { AddressInfo } from 'node:net';
import { WSSession } from '../src/ws-session';

describe('WSSession.connect upgrade headers', () => {
	let wss: WebSocketServer;
	let port: number;
	const seen: Array<Record<string, unknown>> = [];

	beforeAll(async () => {
		wss = new WebSocketServer({
			port: 0,
			host: '127.0.0.1',
			verifyClient: (info: { req: { headers: unknown } }) => {
				seen.push(info.req.headers as Record<string, unknown>);
				return true;
			},
		});
		await new Promise<void>((resolve) => wss.on('listening', resolve));
		port = (wss.address() as AddressInfo).port;
	});

	afterAll(async () => {
		await new Promise<void>((resolve) => wss.close(() => resolve()));
	});

	test('passes the given headers on the upgrade request', async () => {
		const session = await WSSession.connect('127.0.0.1', port, 'token-1', '/', {
			'infer-debug': '1',
		});
		session.close();
		const headers = seen[seen.length - 1]!;
		expect(headers['infer-debug']).toBe('1');
	});

	test('omitting headers sends none of our own', async () => {
		const session = await WSSession.connect('127.0.0.1', port, 'token-2');
		session.close();
		const headers = seen[seen.length - 1]!;
		expect(headers['infer-debug']).toBeUndefined();
	});
});
