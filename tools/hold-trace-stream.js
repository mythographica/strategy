// B1.5 variant: connect CDP, start the stream, then KEEP RUNNING so the
// panel can be observed while edges flow. Stop via task stop.
const { createRequire } = require('node:module');
const req = createRequire('/code/mnemonica/strategy/lib/server.js');

(async () => {
	const store = new Map();
	const ctxFor = (args) => ({ require: req, store, args });

	const stream = req('/code/mnemonica/strategy/commands-rpc/trace-stream.js');

	const fs = require('fs');
	const loadTopLevel = (file) => {
		const code = fs.readFileSync(file, 'utf-8');
		const fn = new Function('ctx', 'require', '__dirname', '__filename', '"use strict"; return (async () => { ' + code + '\n })();');
		return (ctx) => fn(ctx, ctx.require, require('path').dirname(file), file);
	};
	const runConnection = loadTopLevel('/code/mnemonica/strategy/commands-rpc/CDP/connection.js');

	// MNEM_WS_URL / TRACE_CDP_PORT override the canonical rig endpoints for
	// a parallel dev-host instance (see vsc-driver.js port env vars).
	const cdpPort = Number(process.env.TRACE_CDP_PORT) || 9229;
	const wsUrl = process.env.MNEM_WS_URL || undefined;

	console.log('connect:', JSON.stringify(await runConnection(ctxFor({ action: 'connect', port: cdpPort }))));
	console.log('start:', JSON.stringify(await stream.run(ctxFor({ action: 'start', intervalMs: 300, source: 'live-proof', url: wsUrl }))));

	setInterval(async () => {
		try {
			const status = await stream.run(ctxFor({ action: 'status' }));
			console.log('status:', JSON.stringify(status));
		} catch (e) {
			console.error('status err:', e && e.message);
		}
	}, 10000);
})().catch(e => { console.error('ERR', e); process.exit(1); });
