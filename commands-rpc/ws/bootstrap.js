/**
 * MCP Tool Metadata:
 * {
 *   "name": "ws_bootstrap",
 *   "description": "Bootstrap the WS construction channel inside the connected runtime: one CDP evaluate injects a dependency-free WebSocket server, then all construction traffic moves off CDP onto WS",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "examples": [
 *     {
 *       "description": "Start the WS channel in the CDP-connected target",
 *       "args": {}
 *     }
 *   ]
 * }
 */

// Hybrid by design (like every rpc_ command): orchestration runs here in the
// MCP process, the injected cdp-scripts/ws-server.js runs in the target.
// The session token crosses a wire exactly once — as that evaluate's result.

async function run (ctx) {
	const store = ctx.store;
	const require = ctx.require;

	const cdpData = (store && store instanceof Map) ? store.get('cdp') : null;
	if (!cdpData || !cdpData.isConnected) {
		return { success: false, error: 'No CDP connection — run rpc_connection with action "connect" first' };
	}

	try {
		const fs = require('fs');
		const path = require('path');

		const scriptPath = path.join(__dirname, '../../cdp-scripts/ws-server.js');
		const script = fs.readFileSync(scriptPath, 'utf-8');

		const client = cdpData.connection;
		const result = await client.Runtime.evaluate({
			expression: script,
			returnByValue: true,
			awaitPromise: true,
		});

		if (result.exceptionDetails) {
			return {
				success: false,
				error: result.exceptionDetails.exception?.description || 'ws-server injection failed',
			};
		}

		const bootstrap = result.result?.value;
		if (!bootstrap || !bootstrap.success) {
			return { success: false, error: 'ws-server script reported failure', detail: bootstrap || null };
		}

		// The WS client lives in THIS process; the channel handle goes to the store.
		// NB: `require` here is ctx.require (server.ts's module) — resolve the
		// lib path absolutely from __dirname, like cdp-scripts above.
		const wsSessionPath = path.join(__dirname, '../../lib/ws-session.js');
		const { WSSession } = ctx.require(wsSessionPath);
		const session = await WSSession.connect('127.0.0.1', bootstrap.port, bootstrap.token);

		// Verify the channel before declaring it up
		const pong = await session.request('ping');

		// Real mnemonica WSChannel node when the runtime tree exists;
		// the plain-object fallback keeps the command usable without it.
		const runtime = ctx.runtime;
		const channel = (runtime && typeof runtime.WSChannel === 'function')
			? new runtime.WSChannel(bootstrap.port, bootstrap.pid, bootstrap.token, session)
			: {
				port: bootstrap.port,
				pid: bootstrap.pid,
				token: bootstrap.token,
				connectedAt: Date.now(),
				session: session,
			};

		store.set('ws', channel);

		return {
			success: true,
			channel: 'ws',
			port: bootstrap.port,
			pid: bootstrap.pid,
			alreadyRunning: bootstrap.alreadyRunning === true,
			welcome: session.welcome,
			ping: pong,
			note: 'Construction traffic now goes over WS; CDP is free for debugging again',
		};
	} catch (e) {
		return { success: false, error: e.message };
	}
}

module.exports = { run };
