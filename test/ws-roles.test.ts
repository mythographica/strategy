// Mounted channel + role pins (reload-to-dev part B): the channel attaches
// to an EXISTING http.Server as a WebSocket upgrade path (no own listener —
// one pod, one port), observer refuses every write op readably, debug
// refuses trace ops, and teardown never kills the host server.
import { createServer, get as httpGet, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { define } from 'mnemonica';
import { startStrategyClient, type StrategyClientHandle } from '../src/client';
import { WSSession } from '../src/ws-session';

interface RoleWidgetInstance { mark : string }

const RoleWidget = define('RoleWidget', function (this : RoleWidgetInstance) {
	this.mark = 'orig';
});

const listen = (server : HttpServer) : Promise<number> =>
	new Promise((resolve) => {
		server.listen(0, '127.0.0.1', () => {
			resolve((server.address() as AddressInfo).port);
		});
	});

const getText = (port : number, path : string) : Promise<string> =>
	new Promise((resolve, reject) => {
		httpGet({ host: '127.0.0.1', port, path }, (res) => {
			let data = '';
			res.on('data', (chunk : string) => { data += chunk; });
			res.on('end', () => resolve(data));
		}).on('error', reject);
	});

// Simulates a second upgrade consumer on the same server (infer-debug's
// inspector tunnel is the real one): it claims its own paths and 404s the
// rest. While the channel lives it leaves the channel's path alone; the
// flag flips at teardown so a post-stop probe gets a definitive answer
// instead of the limbo a truly unclaimed upgrade leaves.
const claimOtherUpgradePaths = (
	server : HttpServer,
	channelPath : string,
	channelAlive : { value : boolean }
) : void => {
	server.on('upgrade', (req, socket) => {
		const url = new URL(req.url || '/', 'http://localhost');
		if (url.pathname === channelPath && channelAlive.value) {
			return; // the strategy channel's own handler decides this one
		}
		socket.write('HTTP/1.0 404 Not Found\r\n\r\n');
		socket.destroy();
	});
};

// The welcome frame follows the WS handshake; it is not awaited by connect.
const waitFor = async (fn : () => boolean, ms = 2000) : Promise<void> => {
	const deadline = Date.now() + ms;
	while (!fn()) {
		if (Date.now() > deadline) {
			throw new Error('waitFor: condition not met within ' + ms + 'ms');
		}
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
};

describe('mounted channel + observer role', () => {
	let appServer : HttpServer;
	let handle : StrategyClientHandle;
	let session : WSSession;
	let port : number;
	const channelAlive = { value: true };

	beforeAll(async () => {
		appServer = createServer((req, res) => {
			res.writeHead(200, { 'content-type': 'text/plain' });
			res.end('app-reply');
		});
		claimOtherUpgradePaths(appServer, '/strategy', channelAlive);
		port = await listen(appServer);
		handle = await startStrategyClient({ server: appServer, path: '/strategy', role: 'observer' });
		session = await WSSession.connect('127.0.0.1', port, handle.token, '/strategy');
	});

	afterAll(async () => {
		channelAlive.value = false;
		session.close();
		await handle.stop();
		appServer.close();
	});

	test('mounts on the app server: same port, welcome carries role + path', async () => {
		expect(handle.port).toBe(port);
		await waitFor(() => session.welcome !== null);
		expect(session.welcome).toMatchObject({ role: 'observer', path: '/strategy' });
	});

	test('the app own routes keep working alongside the channel', async () => {
		expect(await getText(port, '/')).toBe('app-reply');
	});

	test('a wrong upgrade path is not claimed by the channel', async () => {
		await expect(
			WSSession.connect('127.0.0.1', port, handle.token, '/elsewhere')
		).rejects.toThrow();
	});

	test('a wrong token is still refused on the mounted path', async () => {
		await expect(
			WSSession.connect('127.0.0.1', port, 'wrong-token', '/strategy')
		).rejects.toThrow();
	});

	test('observer refuses every write op readably; reads stay open', async () => {
		await expect(
			session.request('patch', { path: 'RoleWidget', body: 'function () { this.mark = "x"; }' })
		).rejects.toThrow(/"patch" is refused on this channel: role "observer"/);
		await expect(
			session.request('rollback', { path: 'RoleWidget' })
		).rejects.toThrow(/"rollback" is refused/);
		await expect(
			session.request('swap', { path: 'RoleWidget' })
		).rejects.toThrow(/"swap" is refused/);
		await expect(
			session.request('define', { name: 'X', body: 'function () {}' })
		).rejects.toThrow(/"define" is refused/);
		await expect(
			session.request('instantiate', { path: 'RoleWidget' })
		).rejects.toThrow(/"instantiate" is refused/);
		await expect(
			session.request('eval', { expression: '1 + 1' })
		).rejects.toThrow(/"eval" is refused/);

		// reads stay open, and nothing was written
		expect(await session.request('ping', {})).toMatchObject({ pong: true });
		expect(await session.request('list', {})).toBeTruthy();
		expect(new RoleWidget().mark).toBe('orig');
	});

	test('stop detaches only the channel — the app server still serves', async () => {
		channelAlive.value = false;
		session.close();
		await handle.stop();

		expect(await getText(port, '/')).toBe('app-reply');
		await expect(
			WSSession.connect('127.0.0.1', port, handle.token, '/strategy')
		).rejects.toThrow();
	});
});

describe('mounted channel + debug role', () => {
	let appServer : HttpServer;
	let handle : StrategyClientHandle;
	let session : WSSession;
	let port : number;

	beforeAll(async () => {
		appServer = createServer((req, res) => {
			res.writeHead(200, { 'content-type': 'text/plain' });
			res.end('app-reply');
		});
		port = await listen(appServer);
		handle = await startStrategyClient({ server: appServer, path: '/strategy', role: 'debug' });
		session = await WSSession.connect('127.0.0.1', port, handle.token, '/strategy');
	});

	afterAll(async () => {
		session.close();
		await handle.stop();
		appServer.close();
	});

	test('debug allows the hot-swap tools and refuses trace ops readably', async () => {
		await expect(
			session.request('traceSubscribe', {})
		).rejects.toThrow(/"traceSubscribe" is refused on this channel: role "debug"/);
		await expect(
			session.request('traceUnsubscribe', {})
		).rejects.toThrow(/"traceUnsubscribe" is refused/);

		const patched = await session.request('patch', {
			path : 'RoleWidget',
			body : 'function () { this.mark = "patched"; }'
		}) as { sourceURL : string };
		expect(patched.sourceURL).toBe('strategy-patch/RoleWidget@1.js');
		expect(new RoleWidget().mark).toBe('patched');

		expect(await session.request('eval', { expression: '2 + 2' })).toMatchObject({ value: 4 });

		await session.request('rollback', { path: 'RoleWidget' });
		expect(new RoleWidget().mark).toBe('orig');
	});
});
