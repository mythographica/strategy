'use strict';
// Manual probe: what does the CHILD channel's payload see?
// Starts app + infer-debug child, connects to the CHILD channel, runs
// list + eval probes. Evidence for the 'type not found' investigation.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { WSSession } = require('../lib/ws-session');

const APP_DIR = '/code/mnemonica/tactica-nestjs';
const MAIN_PORT = 3199;
const CHILD_PORT = 3200;

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
	const app = spawn('node', [ path.join(__dirname, 'dev-entry-tactica-nestjs.js') ], {
		cwd   : APP_DIR,
		env   : { ...process.env, STRATEGY_CLIENT: '1', INFER_DEBUG: 'true', PORT: String(MAIN_PORT) },
		stdio : 'ignore'
	});
	try {
		for (;;) {
			try { const c = await request(MAIN_PORT, 'GET', '/strategy/channel'); if (c.available) break; } catch {}
			await new Promise((r) => setTimeout(r, 1000));
		}
		await request(MAIN_PORT, 'POST', '/infer-debug/start');
		let childChannel = null;
		for (let i = 0; i < 90 && !childChannel; i++) {
			try { const c = await request(CHILD_PORT, 'GET', '/strategy/channel'); if (c.available) { childChannel = c; } } catch {}
			await new Promise((r) => setTimeout(r, 1500));
		}
		console.log('child channel:', childChannel);
		const session = await WSSession.connect('127.0.0.1', childChannel.port, childChannel.token);
		const list = await session.request('list');
		console.log('list.rootTypes:', list.rootTypes);
		const probe = await session.request('eval', { expression: `
			(function () {
				var t = mnemonica.lookup('UserEntity');
				return {
					found    : !!t,
					version  : (function(){ try { return require('mnemonica/package.json').version; } catch(e) { return 'n/a'; } })(),
					cwd      : process.cwd(),
					defaultKeys : (function(){ try { var k=[]; mnemonica.defaultCollection.forEach(function(c,n){k.push(n);}); return k.slice(0,8); } catch(e){ return String(e.message); } })()
				};
			})()
		` });
		console.log('eval probe:', JSON.stringify(probe));
		const mainChannel = await request(MAIN_PORT, 'GET', '/strategy/channel');
		const mainSession = await WSSession.connect('127.0.0.1', mainChannel.port, mainChannel.token);
		const mainProbe = await mainSession.request('eval', { expression: `
			(function () {
				var t = mnemonica.lookup('UserEntity');
				return { found: !!t, defaultKeys: (function(){ try { var k=[]; mnemonica.defaultCollection.forEach(function(c,n){k.push(n);}); return k.slice(0,8); } catch(e){ return String(e.message); } })() };
			})()
		` });
		console.log('MAIN eval probe:', JSON.stringify(mainProbe));
		session.close();
		mainSession.close();
	} finally {
		app.kill('SIGTERM');
	}
})();
