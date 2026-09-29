'use strict';
// Probe: why does infer-debug stay "not running"? Polls /infer-debug/status
// raw + /infer-debug/logs (child log buffer) after starting the child.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const APP_DIR = '/code/mnemonica/tactica-nestjs';
const MAIN_PORT = 3199;

const request = (port, method, p) => new Promise((resolve, reject) => {
	const req = http.request({ host: '127.0.0.1', port, path: p, method }, (res) => {
		let t = '';
		res.on('data', (c) => { t += c; });
		res.on('end', () => { resolve({ status: res.statusCode, body: t }); });
	});
	req.on('error', reject);
	req.end();
});

(async () => {
	const app = spawn('node', [ path.join(APP_DIR, 'dev-entry.strategy-demo.js') ], {
		cwd   : APP_DIR,
		env   : { ...process.env, STRATEGY_CLIENT: '1', INFER_DEBUG: 'true', PORT: String(MAIN_PORT) },
		stdio : 'ignore'
	});
	try {
		for (;;) {
			try { const c = await request(MAIN_PORT, 'GET', '/strategy/channel'); if (c.status === 200) break; } catch {}
			await new Promise((r) => setTimeout(r, 1000));
		}
		console.log('main up');
		const start = await request(MAIN_PORT, 'POST', '/infer-debug/start');
		console.log('start:', start.status, start.body.slice(0, 200));
		for (let i = 0; i < 40; i++) {
			const st = await request(MAIN_PORT, 'GET', '/infer-debug/status');
			console.log(`t+${i * 3}s status:`, st.body.replace(/\n/g, ' | ').slice(0, 220));
			if (st.body.includes('running: yes')) { break; }
			await new Promise((r) => setTimeout(r, 3000));
		}
		const logs = await request(MAIN_PORT, 'GET', '/infer-debug/logs?lines=30');
		console.log('--- child log buffer ---');
		console.log(logs.body.slice(0, 2500));
	} finally {
		try { await request(MAIN_PORT, 'POST', '/infer-debug/stop'); } catch {}
		app.kill('SIGTERM');
	}
})();
