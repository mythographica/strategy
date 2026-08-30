#!/usr/bin/env node
'use strict';

// Lean CDP driver for the VS Code dev instance.
// Slots: ext = extension host inspector (:9233), ui = workbench (:9222).
// Usage:
//   node vsc-driver.js ext '<js expression, awaited>'
//   node vsc-driver.js ui  '<js expression, awaited>'
//   node vsc-driver.js shot /tmp/shot.png

const { createRequire } = require('node:module');
const fs = require('node:fs');
const req = createRequire('/code/mnemonica/strategy/lib/server.js');
const CDP = req('chrome-remote-interface');

const PORTS = { ext: 9233, ui: 9223 };

async function pickTarget (port, slot) {
	const targets = await CDP.List({ port });
	if (slot === 'ui') {
		const page = targets.find(t => t.type === 'page' && /workbench\.html/.test(t.url || ''));
		const chosen = page || targets.find(t => t.type === 'page');
		return chosen ? chosen.id : undefined;
	}
	// ext: node inspector exposes a single target
	return undefined;
}

async function main () {
	const [slot, ...rest] = process.argv.slice(2);
	if (!slot) {
		console.error('usage: vsc-driver.js <ext|ui|shot> ...');
		process.exit(2);
	}

	if (slot === 'shot') {
		const out = rest[0] || '/tmp/vsc-shot.png';
		const targetId = await pickTarget(PORTS.ui, 'ui');
		const client = await CDP({ port: PORTS.ui, target: targetId });
		await client.Page.enable();
		const shot = await client.Page.captureScreenshot({ format: 'png' });
		fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
		console.log(out);
		await client.close();
		process.exit(0);
		return;
	}

	const port = PORTS[slot];
	if (!port) {
		console.error('unknown slot:', slot);
		process.exit(2);
	}
	const targetId = await pickTarget(port, slot);
	const client = await CDP({ port, target: targetId });
	await client.Runtime.enable();
	const expression = rest.join(' ');
	const result = await client.Runtime.evaluate({
		expression,
		awaitPromise: true,
		returnByValue: true
	});
	if (result.exceptionDetails) {
		const exc = result.exceptionDetails;
		const desc = exc.exception && exc.exception.description ? exc.exception.description : exc.text;
		console.error('EXCEPTION:', desc);
		process.exitCode = 1;
	} else {
		console.log(JSON.stringify(result.result.value, null, 2));
	}
	await client.close();
	process.exit(0);
}

main().catch(err => {
	console.error('DRIVER ERROR:', err && err.message ? err.message : err);
	process.exit(1);
});
