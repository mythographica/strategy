'use strict';
// The decisive probe: from INSIDE the main app (via its own strategy
// channel's eval op), TCP-probe the child's port and dump what the main
// process sees. If net.connect to 3200 works here, infer-debug's health
// check has no reason to fail; if it fails, we see the exact error.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { WSSession } = require('../lib/ws-session');

const APP_DIR = '/code/mnemonica/tactica-nestjs';
const MAIN_PORT = 3199;

const request = (port, method, p) => new Promise((resolve, reject) => {
	const req = http.request({ host: '127.0.0.1', port, path: p, method }, (res) => {
		let t = '';
		res.on('data', (c) => { t += c; });
		res.on('end', () => { try { resolve(JSON.parse(t)); } catch { resolve(t); } });
	});
	req.on('error', reject);
	req.end();
});

(async () => {
	const app = spawn('node', [ path.join(APP_DIR, 'dev-entry.strategy-demo.js') ], {
		cwd : APP_DIR,
		env : { ...process.env, STRATEGY_CLIENT: '1', INFER_DEBUG: 'true', PORT: String(MAIN_PORT) },
		stdio : 'ignore'
	});
	try {
		let mainChannel = null;
		for (let i = 0; i < 90 && !mainChannel; i++) {
			try { const c = await request(MAIN_PORT, 'GET', '/strategy/channel'); if (c.available) { mainChannel = c; } } catch {}
			await new Promise((r) => setTimeout(r, 1000));
		}
		console.log('main up:', mainChannel.pid);
		await request(MAIN_PORT, 'POST', '/infer-debug/start');
		await new Promise((r) => setTimeout(r, 30000)); // let the child boot

		const session = await WSSession.connect('127.0.0.1', mainChannel.port, mainChannel.token);
		const probe = await session.request('eval', { expression: `
			(function () {
				var net = process.getBuiltinModule('node:net');
				return new Promise(function (resolve) {
					var socket = net.connect({ host: '127.0.0.1', port: 3200 }, function () {
						socket.end();
						resolve({ tcp3200: 'CONNECTED', envPort: process.env.PORT });
					});
					socket.setTimeout(4000, function () {
						socket.destroy();
						resolve({ tcp3200: 'TIMEOUT', envPort: process.env.PORT });
					});
					socket.on('error', function (e) {
						resolve({ tcp3200: 'ERROR: ' + e.message, envPort: process.env.PORT });
					});
				});
			})()
		` });
		console.log('in-main TCP probe of 3200:', JSON.stringify(probe));
		const status = await request(MAIN_PORT, 'GET', '/infer-debug/status');
		console.log('status:', String(status.body).split('\n')[0]);
		session.close();
	} finally {
		try { await request(MAIN_PORT, 'POST', '/infer-debug/stop'); } catch {}
		app.kill('SIGTERM');
	}
})();
