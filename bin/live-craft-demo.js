#!/usr/bin/env node
'use strict';

// live-craft-demo — define a mnemonica type in a RUNNING app, swap its
// constructor on the flight, and construct again. No CDP, no restart.
// See docs/live-craft.md for what this mode is for.
//
// Connection, either of:
//   DISCOVERY_URL=http://127.0.0.1:3100/strategy/channel  (fetch port+token)
//   WS_PORT=9400 WS_TOKEN=<token> [WS_HOST=127.0.0.1]     (manual)

const path = require('path');
const { WSSession } = require(path.join(__dirname, '..', 'lib', 'ws-session.js'));

const IMPL_A = `function (data) {
	this.mark = 'impl-A';
	this.value = data && data.value;
}`;

const IMPL_B = `function (data) {
	this.mark = 'impl-B';
	this.value = (data && data.value) * 10;
	this.swapped = true;
}`;

async function resolveEndpoint () {
	if (process.env.WS_PORT && process.env.WS_TOKEN) {
		const manual = {
			host : process.env.WS_HOST || '127.0.0.1',
			port : Number(process.env.WS_PORT),
			token : process.env.WS_TOKEN,
		};
		return manual;
	}
	const discoveryUrl = process.env.DISCOVERY_URL
		|| 'http://127.0.0.1:3000/strategy/channel';
	const response = await fetch(discoveryUrl);
	const info = await response.json();
	if (!info.available) {
		throw new Error(`discovery says the channel is not available: ${JSON.stringify(info)}`);
	}
	const discovered = { host : '127.0.0.1', port : info.port, token : info.token };
	return discovered;
}

async function main () {
	const endpoint = await resolveEndpoint();
	console.log(`connecting to app channel at ${endpoint.host}:${endpoint.port} ...`);
	const session = await WSSession.connect(endpoint.host, endpoint.port, endpoint.token);
	// the welcome frame rides in right after the handshake — wait for it
	for (let i = 0; i < 40 && !session.welcome; i++) {
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	console.log(`welcome: pid=${session.welcome && session.welcome.pid} mnemonica=${session.welcome && session.welcome.mnemonica}`);

	let traceEdges = 0;
	session.setNotificationHandler('trace', (params) => {
		traceEdges += (params && Array.isArray(params.edges)) ? params.edges.length : 0;
	});
	await session.request('traceSubscribe');

	// 1. define over WS — the type is BORN SHIMMED (stable shell, swappable impl)
	const defined = await session.request('define', { name : 'LiveCraft', body : IMPL_A });
	console.log('define:', JSON.stringify(defined));

	// 2. construct with impl A
	const before = await session.request('instantiate', {
		path : 'LiveCraft',
		args : [{ value : 1 }],
	});
	console.log('instantiate (impl A):', JSON.stringify(before.instance));

	// 3. swap the constructor ON THE FLIGHT — same type, same prototype
	//    chain, existing instances untouched; the next `new` runs impl B
	const swapped = await session.request('swap', { path : 'LiveCraft', body : IMPL_B });
	console.log('swap:', JSON.stringify(swapped));

	// 4. construct again — different behavior, same type identity
	const after = await session.request('instantiate', {
		path : 'LiveCraft',
		args : [{ value : 1 }],
	});
	console.log('instantiate (impl B):', JSON.stringify(after.instance));

	// 5. the guard: source-born types are NOT swappable
	const guardProbe = (session.welcome && session.welcome.rootTypes[0]) || null;
	if (guardProbe) {
		try {
			await session.request('swap', { path : guardProbe, body : IMPL_B });
			console.log(`swap guard: UNEXPECTEDLY swapped source-born "${guardProbe}"`);
		} catch (err) {
			console.log(`swap guard: refused to swap source-born "${guardProbe}" — ${err.message}`);
		}
	}

	const listed = await session.request('list');
	const liveCraftEntry = (listed.shimmed || []).filter((entry) => entry.path === 'LiveCraft')[0];
	console.log('registry entry:', JSON.stringify(liveCraftEntry));
	// trace pushes flush on an interval in the target — give them a beat
	await new Promise((resolve) => setTimeout(resolve, 800));
	console.log(`trace edges observed during the demo: ${traceEdges}`);

	session.close();
}

main().then(() => {
	process.exit(0);
}).catch((err) => {
	console.error('demo failed:', err.message);
	process.exit(1);
});
