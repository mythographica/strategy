'use strict';

// Mode 1 live-patch demo — reload-to-dev step 2 (scripted, re-runnable).
//
// Flow (acceptance per plans/reload-to-dev.md):
//   1. tactica-nestjs runs in dev WITHOUT --watch, strategy self-hosted
//      (STRATEGY_CLIENT=1), infer-debug enabled (INFER_DEBUG=true).
//   2. POST /infer-debug/start forks a debug CHILD (app port + 1, --inspect);
//      only requests carrying the `infer-debug` header reach it.
//      The child inherits env — it self-hosts its OWN strategy channel, so
//      the patch lands on the child through its own discovery endpoint
//      (no CDP injection needed for the channel itself).
//   3. ws_patch UserEntity IN THE CHILD.
//   4. Proof: infer-debug-header request shows the NEW behaviour; the
//      unmarked request keeps the RELEASED behaviour; the main pid and the
//      child pid are unchanged (no restart anywhere).
//   5. ws_rollback; the infer-debug-header request shows the released
//      behaviour again.
//   6. Stop the child, stop the app.
//
// Run from the strategy worktree: node tools/demo-mode1-shape-change.js
//
// SHAPE-change variant of the Mode 1 demo: the patched UserEntity handler
// changes a VALUE (name -> PATCHED:ada), ADDS a field (source), and RENAMES
// a field (name -> displayName). The point is to see what the HTTP reply
// REALLY carries: the DTO assembly (user.service.ts createUser copies
// id/email/name/type into the UserResponse) may strip the added/renamed
// fields — that is recorded, NOT worked around.

const { spawn } = require('child_process');
const http = require('http');
const { WSSession } = require('../lib/ws-session');

const APP_DIR = '/code/mnemonica/tactica-nestjs';
const MAIN_PORT = 3199;
const CHILD_PORT = MAIN_PORT + 1;

const evidence = [];
const log = (label, value) => {
	const line = `${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`;
	evidence.push(line);
	console.log(line);
};

const request = (port, method, path, { headers = {}, body } = {}) => new Promise((resolve, reject) => {
	const data = body ? JSON.stringify(body) : null;
	const req = http.request({
		host : '127.0.0.1',
		port,
		path,
		method,
		headers : {
			...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}),
			...headers
		}
	}, (res) => {
		let text = '';
		res.on('data', (c) => { text += c; });
		res.on('end', () => {
			try { resolve({ status : res.statusCode, body : JSON.parse(text) }); }
			catch { resolve({ status : res.statusCode, body : text }); }
		});
	});
	req.on('error', reject);
	if (data) { req.write(data); }
	req.end();
});

const waitFor = async (label, fn, timeoutMs = 120000, everyMs = 1000) => {
	const start = Date.now();
	for (;;) {
		try {
			const value = await fn();
			if (value) { return value; }
		} catch { /* not up yet */ }
		if (Date.now() - start > timeoutMs) {
			throw new Error(`timeout waiting for ${label}`);
		}
		await new Promise((r) => setTimeout(r, everyMs));
	}
};

// SHAPE-change probe: value change + ADDED field + RENAMED field. The
// console.log lands in the CHILD's stdout (infer-debug log buffer) — the
// in-memory truth the HTTP reply may or may not carry through the DTO layer.
const PATCH_BODY = 'function (data) {'
	+ ' this.id = data.id;'
	+ ' this.email = data.email;'
	+ ' this.displayName = "PATCHED:" + data.name;'
	+ ' this.source = "partner-api";'
	+ ' console.log("[shape-probe] UserEntity in-memory keys:", Object.keys(this).join(","));'
	+ ' }';
const USER = () => ({ name : 'ada', email : 'ada@example.com' });

async function portBusy (port) {
	return new Promise((resolve) => {
		const probe = http.request({ host: '127.0.0.1', port, path: '/', method: 'HEAD', timeout: 800 }, () => {
			probe.destroy();
			resolve(true);
		});
		probe.on('error', () => resolve(false));
		probe.on('timeout', () => { probe.destroy(); resolve(false); });
		probe.end();
	});
}

async function main () {
	if (await portBusy(MAIN_PORT) || await portBusy(CHILD_PORT)) {
		console.error('REFUSING to start: port ' + MAIN_PORT + ' or ' + CHILD_PORT +
			' is already busy — a previous app/child is still alive; kill it first');
		process.exit(1);
	}
	log('step', 'starting tactica-nestjs (no --watch, STRATEGY_CLIENT=1, INFER_DEBUG=true)');
	// the shim entry (argv[1]) is what infer-debug re-spawns as the child —
	// it registers ts-node, which the child's plain spawn would otherwise miss
	const app = spawn('node', [ require('path').join(APP_DIR, 'dev-entry.strategy-demo.js') ], {
		cwd : APP_DIR,
		env : { ...process.env, STRATEGY_CLIENT : '1', INFER_DEBUG : 'true', PORT : String(MAIN_PORT) },
		// probe-parity: the standalone readiness probe uses 'ignore' and the
		// child always becomes ready; piped stdio is the one remaining
		// difference under investigation
		stdio : [ 'ignore', 'pipe', 'pipe' ]
	});
	let appLog = '';
	app.stdout.on('data', (c) => { appLog += c; });
	app.stderr.on('data', (c) => { appLog += c; });

	try {
		const mainChannel = await waitFor('main app + strategy channel', async () => {
			const r = await request(MAIN_PORT, 'GET', '/strategy/channel');
			return r.status === 200 && r.body && r.body.available ? r.body : null;
		});
		log('main app up', { pid : mainChannel.pid, port : MAIN_PORT });

		// infer-debug's internal readiness window is ~120s; on a loaded
		// machine the ts-node child can boot slower than that and the start
		// dies — retry the start once after a settle pause
		let childChannel = null;
		for (let attempt = 1; attempt <= 2 && !childChannel; attempt++) {
			log('step', 'POST /infer-debug/start (fork the debug child), attempt ' + attempt);
			const startRes = await request(MAIN_PORT, 'POST', '/infer-debug/start');
			log('infer-debug/start', { status : startRes.status });
			// NOTE: /infer-debug/status answers TEXT ("running: yes ..."), not JSON
			const ready = await waitFor('infer-debug status running', async () => {
				const r = await request(MAIN_PORT, 'GET', '/infer-debug/status');
				let childUp = false;
				try {
					const c = await request(CHILD_PORT, 'GET', '/strategy/channel');
					childUp = c.status === 200;
				} catch { /* child not listening */ }
				// status TEXT grammar: '<state>: <zombie> zombie: debugger <...>'
				// — 'running: no' means RUNNING with NO zombie (misread once)
				const state = typeof r.body === 'string' ? r.body.split(':')[0].trim() : '';
				console.log('  poll: state=' + state + ' child-listening=' + childUp);
				if (r.status === 200 && state === 'running') {
					return r.body;
				}
				return null;
			}, 150000, 3000).catch(() => null);
			if (ready) {
				log('infer-debug status', ready.split('\n')[0]);
				childChannel = await waitFor('child app + its own strategy channel', async () => {
					const r = await request(CHILD_PORT, 'GET', '/strategy/channel');
					return r.status === 200 && r.body && r.body.available ? r.body : null;
				}, 120000, 1500);
				break;
			}
			log('infer-debug readiness', 'not ready within 150s — stopping the child and retrying');
			await request(MAIN_PORT, 'POST', '/infer-debug/stop');
			await new Promise((r) => setTimeout(r, 5000));
		}
		if (!childChannel) {
			const last = await request(MAIN_PORT, 'GET', '/infer-debug/status');
			throw new Error('infer-debug child never became ready (2 attempts) — last status: ' + JSON.stringify(last.body));
		}
		log('child app up', { pid : childChannel.pid, port : CHILD_PORT });
		if (childChannel.pid === mainChannel.pid) {
			throw new Error('child pid == main pid — the child did not fork');
		}

		log('step', 'baseline: POST /users (unmarked -> main, infer-debug header -> child)');
		const baseMain = await request(MAIN_PORT, 'POST', '/users', { body : USER() });
		const baseChild = await request(MAIN_PORT, 'POST', '/users', {
			body : USER(),
			headers : { 'infer-debug' : '1' }
		});
		log('REPLY 1 baseline main (released) full', { status: baseMain.status, body: baseMain.body });
		log('REPLY 2 baseline child (unpatched) full', { status: baseChild.status, body: baseChild.body });

		log('step', 'attach to the CHILD strategy channel and ws_patch UserEntity (SHAPE change)');
		const session = await WSSession.connect('127.0.0.1', childChannel.port, childChannel.token);
		const patched = await session.request('patch', { path : 'UserEntity', body : PATCH_BODY });
		log('ws_patch UserEntity in child', patched);

		const afterChild = await request(MAIN_PORT, 'POST', '/users', {
			body : USER(),
			headers : { 'infer-debug' : '1' }
		});
		const afterMain = await request(MAIN_PORT, 'POST', '/users', { body : USER() });
		log('REPLY 3 patched child (marked) full', { status: afterChild.status, body: afterChild.body });
		log('REPLY 4 main DURING patch (unmarked) full', { status: afterMain.status, body: afterMain.body });

		// in-memory truth, straight from the child: the patched instance and a
		// subtype built from it — no HTTP/DTO in the way
		const memProbe = await session.request('eval', { expression: `
			(function () {
				var User = mnemonica.lookup('UserEntity');
				var u = new User({ id: 'mem-1', email: 'mem@example.com', name: 'ada' });
				var admin = new u.AdminEntity({ id: 'mem-1', email: 'mem@example.com', name: 'ada', role: 'root' });
				return {
					userKeys     : Object.keys(u),
					userSource   : u.source,
					userDisplay  : u.displayName,
					userName     : u.name,
					adminKeys    : Object.keys(admin),
					adminSource  : admin.source,
					adminDisplay : admin.displayName,
					adminName    : admin.name
				};
			})()
		` });
		log('IN-MEMORY in child (patched user + AdminEntity subtype)', memProbe);

		const adminReply = await request(MAIN_PORT, 'POST', '/admins', {
			body : { name : 'ada', email : 'ada@example.com', role : 'root' },
			headers : { 'infer-debug' : '1' }
		});
		log('REPLY 5 admin subtype (marked) full', { status: adminReply.status, body: adminReply.body });

		if (!(afterMain.body && afterMain.body.name === 'ada' && !('source' in afterMain.body))) {
			throw new Error('unmarked request did not keep the released shape');
		}

		log('step', 'ws_rollback UserEntity in the child');
		const rolled = await session.request('rollback', { path : 'UserEntity' });
		log('ws_rollback', rolled);

		const rolledChild = await request(MAIN_PORT, 'POST', '/users', {
			body : USER(),
			headers : { 'infer-debug' : '1' }
		});
		log('REPLY 6 child after rollback (marked) full', { status: rolledChild.status, body: rolledChild.body });
		if (!(rolledChild.body && rolledChild.body.name === 'ada' && !('displayName' in rolledChild.body) && !('source' in rolledChild.body))) {
			throw new Error('rollback did not restore the released shape exactly');
		}
		session.close();

		const stillMain = await request(MAIN_PORT, 'GET', '/strategy/channel');
		log('main pid unchanged', stillMain.body && stillMain.body.pid === mainChannel.pid);

		log('step', 'cleanup: stop the child, then the app');
		await request(MAIN_PORT, 'POST', '/infer-debug/stop');
		// the patch body's own console.log + any Nest error stack live in the
		// captured app log — the layer that rejected the new shape names itself
		console.log('--- child stdout evidence (shape-probe + errors) ---');
		console.log(appLog.split('\n').filter((l) => /shape-probe|Error|error|Exception/i.test(l)).slice(0, 25).join('\n'));
		log('RESULT', 'PASS — Mode 1 SHAPE change: value + added + renamed fields; replies above; rollback restored the released shape');
	} catch (err) {
		log('RESULT', `FAIL — ${err.message}`);
		try {
			const logs = await request(MAIN_PORT, 'GET', '/infer-debug/logs?lines=40');
			console.log('--- child log buffer (/infer-debug/logs) ---');
			console.log(typeof logs.body === 'string' ? logs.body.slice(0, 3000) : JSON.stringify(logs.body).slice(0, 3000));
		} catch (dumpErr) {
			console.log('--- child log buffer unavailable: ' + dumpErr.message);
		}
		// child spawn evidence lives at the START of the app log — never
		// tail-only dumps
		console.log('--- app log (first 60 lines) ---');
		console.log(appLog.split('\n').slice(0, 60).join('\n'));
		console.log('--- InferDebug-relevant app log lines ---');
		console.log(appLog.split('\n').filter((l) => /InferDebug|Discovered|self-hosted|Child/i.test(l)).slice(0, 40).join('\n'));
		process.exitCode = 1;
	} finally {
		// stop the infer-debug child through the control API BEFORE killing
		// the host — otherwise the forked child outlives it as a zombie
		try { await request(MAIN_PORT, 'POST', '/infer-debug/stop'); } catch {}
		app.kill('SIGTERM');
		setTimeout(() => { try { app.kill('SIGKILL'); } catch {} }, 3000).unref();
	}
}

main();
