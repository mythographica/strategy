'use strict';
// Fixture for the ws reload pins: a stand-in for a BUILT app module — plain
// exports, a mnemonica definition, a top-level registerHook. Loaded through
// NODE's own require (createRequire) so it shares the payload's module
// registry and mnemonica instance; the tests send NEW code for this file
// through the `reload` op and assert what changes and what stays connected.
const { define, registerHook, lookup } = require('mnemonica');

const ReloadWidget = define('ReloadWidget', function (v) {
	this.v = v;
});
const ReloadExtra = define('ReloadExtra', function () {
	this.e = true;
});

registerHook(ReloadWidget, 'postCreation', () => {
	const g = globalThis;
	g.__reloadHookLog = g.__reloadHookLog || [];
	g.__reloadHookLog.push(1);
});

const plainFn = () => 'plain-v1';

module.exports = { ReloadWidget, ReloadExtra, plainFn, lookup };
