'use strict';
// Child process for the ws-reload jest pins — runs in PLAIN node (jest's
// sandboxed realm cannot address Module._cache, which the reload op works
// on; see the REALM NOTE in ws-reload.test.ts). Loads the fixture through
// the real require, starts the strategy channel, and drives the reload and
// liveEdit ops against its own process. Prints one JSON line per check;
// exits non-zero on the first failure.
const path = require('node:path');
const { startStrategyClient } = require('../lib/client');
const { WSSession } = require('../lib/ws-session');

const fixturePath = require.resolve('./fixtures/reload-app-module.js');
delete require.cache[fixturePath];
const g = globalThis;
delete g.__reloadHookLog;

const V2_CODE = `'use strict';
const { define, registerHook } = require('mnemonica');
const ReloadWidget = define('ReloadWidget', function (v) { this.v = v + '-v2'; });
registerHook(ReloadWidget, 'postCreation', () => {
	const g = globalThis;
	g.__reloadHookLog = g.__reloadHookLog || [];
	g.__reloadHookLog.push(100);
});
const plainFn = () => 'plain-v2';
const ReloadNew = define('ReloadNew', function () { this.n = true; });
module.exports = { ReloadWidget, plainFn, ReloadNew };
`;

// NOTE: liveEdit reaches held references only while the whole edit keeps
// the script's structural positions (V8 live-edit matching) — V3 is V2 with
// exactly one function body changed. A structural rewrite is what `reload`
// is for.
const V3_CODE = `'use strict';
const { define, registerHook } = require('mnemonica');
const ReloadWidget = define('ReloadWidget', function (v) { this.v = v + '-v2'; });
registerHook(ReloadWidget, 'postCreation', () => {
	const g = globalThis;
	g.__reloadHookLog = g.__reloadHookLog || [];
	g.__reloadHookLog.push(100);
});
const plainFn = () => 'plain-v3';
const ReloadNew = define('ReloadNew', function () { this.n = true; });
module.exports = { ReloadWidget, plainFn, ReloadNew };
`;

const results = [];
let session = null;
let handle = null;
const finish = async () => {
	if (session) { session.close(); }
	if (handle) { await handle.stop(); }
	process.exit(process.exitCode || 0);
};
function check (name, actual, expected) {
	const ok = JSON.stringify(actual) === JSON.stringify(expected);
	results.push({ name, ok, actual, expected });
	console.log(JSON.stringify({ step: name, ok, actual, expected }));
	if (!ok) {
		process.exitCode = 1;
		throw new Error('pin failed: ' + name);
	}
}

(async () => {
	const { lookup } = require('mnemonica');
	const fixture = require('./fixtures/reload-app-module.js');

	const handle = await startStrategyClient();
	session = await WSSession.connect('127.0.0.1', handle.port, handle.token);

	// baseline
	check('baseline construct', new fixture.ReloadWidget('a').v, 'a');
	check('baseline plainFn', fixture.plainFn(), 'plain-v1');
	g.__reloadHookLog = [];
	new fixture.ReloadWidget('b');
	check('baseline hook fires once', g.__reloadHookLog, [1]);

	// reload to v2
	const oldInstance = new fixture.ReloadWidget('old');
	const reloaded = await session.request('reload', { module: fixturePath, code: V2_CODE });
	check('reload scriptName ?v=1', reloaded.scriptName, fixturePath + '?v=1');
	check('reload swapped lists ReloadWidget', reloaded.swapped.includes('ReloadWidget'), true);
	check('plain export now v2', fixture.plainFn(), 'plain-v2');
	check('same type object', lookup('ReloadWidget') === fixture.ReloadWidget, true);
	check('new handler', new fixture.ReloadWidget('x').v, 'x-v2');
	check('old instance keeps data', oldInstance.v, 'old');

	// hooks replaced, not duplicated
	g.__reloadHookLog = [];
	new fixture.ReloadWidget('hook-check');
	check('hook replaced, exactly one fire', g.__reloadHookLog, [100]);

	// removed type stays; new type defines
	check('removed type stays declared', new fixture.ReloadExtra().e, true);
	check('new type defined', new (lookup('ReloadNew'))().n, true);

	// versioning + refusals
	const second = await session.request('reload', { module: fixturePath, code: V2_CODE });
	check('second reload ?v=2', second.scriptName, fixturePath + '?v=2');
	let refusal = null;
	try {
		await session.request('reload', { module: '/no/such/module.js', code: V2_CODE });
	} catch (e) {
		refusal = e.message;
	}
	check('not-loaded refusal', /not loaded in this process/.test(refusal || ''), true);
	refusal = null;
	try {
		await session.request('reload', { module: fixturePath, code: 'import x from "y"; module.exports = x;' });
	} catch (e) {
		refusal = e.message;
	}
	check('esm refusal readable', /compilation .* failed/.test(refusal || ''), true);

	// liveEdit (option b): reaches the plain export through the cache object
	const edit = await session.request('liveEdit', { module: fixturePath, code: V3_CODE });
	if (!edit.edit || !edit.edit.status) {
		check('liveEdit surfaced the script', edit.edit, 'status present');
	}
	check('liveEdit status Ok', edit.edit.status, 'Ok');
	check('liveEdit applied in place', fixture.plainFn(), 'plain-v3');

	// reload still works after a liveEdit
	const third = await session.request('reload', { module: fixturePath, code: V2_CODE });
	check('third reload ?v=3', third.scriptName, fixturePath + '?v=3');
	check('plain export back to v2', fixture.plainFn(), 'plain-v2');

	console.log(JSON.stringify({ step: 'ALL PINS PASSED', count: results.length }));
	await finish();
})().catch(async (e) => {
	console.log(JSON.stringify({ step: 'CHILD ERROR', error: e.message }));
	await finish();
});
