'use strict';
// Child process for the ws-reload jest pins — runs in PLAIN node (jest's
// sandboxed realm cannot address Module._cache, which the reload op works
// on; see the REALM NOTE in ws-reload.test.ts). Loads the fixture through
// the real require, starts the strategy channel, and drives the reload and
// liveEdit ops against its own process. Prints one JSON line per check;
// exits non-zero on the first failure.
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
registerHook(ReloadWidget, 'postCreation', () => {
	const g = globalThis;
	g.__reloadHookLog = g.__reloadHookLog || [];
	g.__reloadHookLog.push(200);
});
const plainFn = () => 'plain-v2';
const ReloadNew = define('ReloadNew', function () { this.n = true; });
module.exports = { ReloadWidget, plainFn, ReloadNew };
`;

// V3: same module but NO hook registrations — the module's hooks must be
// REPLACED BY NOTHING (its previous two hooks removed), foreign hooks survive
const V3_CODE = `'use strict';
const { define } = require('mnemonica');
const ReloadWidget = define('ReloadWidget', function (v) { this.v = v + '-v2'; });
const plainFn = () => 'plain-v2';
const ReloadNew = define('ReloadNew', function () { this.n = true; });
module.exports = { ReloadWidget, plainFn, ReloadNew };
`;

// a module that defines then THROWS: the reload must fail atomically — no
// handler swap, no hook change, no consumed version
const BROKEN_CODE = `'use strict';
const { define } = require('mnemonica');
define('ReloadWidget', function (v) { this.v = v + '-BROKEN'; });
throw new Error('boom');
`;

// liveEdit (option b): shape-preserving one-function edit of V3
const V4_CODE = `'use strict';
const { define } = require('mnemonica');
const ReloadWidget = define('ReloadWidget', function (v) { this.v = v + '-v2'; });
const plainFn = () => 'plain-v4';
const ReloadNew = define('ReloadNew', function () { this.n = true; });
module.exports = { ReloadWidget, plainFn, ReloadNew };
`;

const sorted = (arr) => arr.slice().sort((a, b) => a - b);

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
	const { lookup, registerHook } = require('mnemonica');
	const fixture = require('./fixtures/reload-app-module.js');

	handle = await startStrategyClient();
	session = await WSSession.connect('127.0.0.1', handle.port, handle.token);

	// baseline
	check('baseline construct', new fixture.ReloadWidget('a').v, 'a');
	check('baseline plainFn', fixture.plainFn(), 'plain-v1');
	g.__reloadHookLog = [];
	new fixture.ReloadWidget('b');
	check('baseline hook fires once', g.__reloadHookLog, [1]);

	// a FOREIGN hook on the same type, registered by another party (not
	// through any module reload) — must survive every reload below
	registerHook(fixture.ReloadWidget, 'postCreation', () => {
		g.__reloadHookLog.push(7);
	});
	g.__reloadHookLog = [];
	new fixture.ReloadWidget('c');
	check('foreign hook fires alongside', sorted(g.__reloadHookLog), [1, 7]);

	// reload to v2 (two same-type hooks)
	const oldInstance = new fixture.ReloadWidget('old');
	const reloaded = await session.request('reload', { module: fixturePath, code: V2_CODE });
	check('reload scriptName ?v=1', reloaded.scriptName, fixturePath + '?v=1');
	check('reload swapped lists ReloadWidget', reloaded.swapped.includes('ReloadWidget'), true);
	check('plain export now v2', fixture.plainFn(), 'plain-v2');
	check('same type object', lookup('ReloadWidget') === fixture.ReloadWidget, true);
	check('new handler', new fixture.ReloadWidget('x').v, 'x-v2');
	check('old instance keeps data', oldInstance.v, 'old');

	// F1: the module's TWO new hooks both fire; the original (1) is gone;
	// the foreign hook (7) survived
	g.__reloadHookLog = [];
	new fixture.ReloadWidget('hook-check');
	check('F1 two new hooks fire, original replaced, foreign survives',
		sorted(g.__reloadHookLog), [7, 100, 200]);

	// removed type stays; new type defines
	check('removed type stays declared', new fixture.ReloadExtra().e, true);
	check('new type defined', new (lookup('ReloadNew'))().n, true);

	// F2: a module that defines then throws — atomic refusal
	let failure = null;
	try {
		await session.request('reload', { module: fixturePath, code: BROKEN_CODE });
	} catch (e) {
		failure = e.message;
	}
	check('F2 throwing module refused', /evaluation of .* failed: boom/.test(failure || ''), true);
	g.__reloadHookLog = [];
	const stillV2 = new fixture.ReloadWidget('still-v2');
	check('F2 old handler still active', stillV2.v, 'still-v2-v2');
	check('F2 hooks unchanged', sorted(g.__reloadHookLog), [7, 100, 200]);

	// refusals (a failed reload must not consume a version)
	const second = await session.request('reload', { module: fixturePath, code: V2_CODE });
	check('version after failed reload is ?v=2', second.scriptName, fixturePath + '?v=2');
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
	check('esm refusal readable', /evaluation of .* failed/.test(refusal || ''), true);

	// F1 continued: a reload whose file has NO hooks removes exactly the
	// module's own hooks — the foreign hook is still there
	const third = await session.request('reload', { module: fixturePath, code: V3_CODE });
	check('third reload ?v=3', third.scriptName, fixturePath + '?v=3');
	g.__reloadHookLog = [];
	new fixture.ReloadWidget('no-hooks');
	check('F1 module hooks removed, foreign survives', sorted(g.__reloadHookLog), [7]);

	// F3: liveEdit while 'debugger;' statements hammer the loop — without
	// setSkipAllPauses the thread would pause forever (in-process, nothing
	// can resume it); the op must complete
	const hammer = setInterval(() => {
		session.request('eval', { expression: '(() => { debugger; return 1; })()' }).catch(() => {});
	}, 25);
	const edit = await session.request('liveEdit', { module: fixturePath, code: V4_CODE });
	clearInterval(hammer);
	if (!edit.edit || !edit.edit.status) {
		check('liveEdit surfaced the script', edit.edit, 'status present');
	}
	check('F3 liveEdit completed despite debugger; hammer', edit.edit.status, 'Ok');
	check('liveEdit applied in place', fixture.plainFn(), 'plain-v4');

	// reload still works after a liveEdit
	const fourth = await session.request('reload', { module: fixturePath, code: V2_CODE });
	check('fourth reload ?v=4', fourth.scriptName, fixturePath + '?v=4');
	check('plain export back to v2', fixture.plainFn(), 'plain-v2');
	g.__reloadHookLog = [];
	new fixture.ReloadWidget('hooks-back');
	check('hooks re-journaled after re-add', sorted(g.__reloadHookLog), [7, 100, 200]);

	console.log(JSON.stringify({ step: 'ALL PINS PASSED', count: results.length }));
	await finish();
})().catch(async (e) => {
	console.log(JSON.stringify({ step: 'CHILD ERROR', error: e.message }));
	await finish();
});
