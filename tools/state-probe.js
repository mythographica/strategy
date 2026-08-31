// state/query probe for mnemographica's strategy WS (:9231).
// Usage: node state-probe.js [subject] [sample] [level]
//   subject: server | graph | trace | view | logs   (default server)
//   sample : number of tail entries for trace/logs  (default per subject)
//   level  : optional log-level filter (logs only)
const { createRequire } = require('node:module');
const req = createRequire('/code/mnemonica/mnemographica/package.json');
const WebSocket = req('ws');
(async () => {
	const subject = process.argv[2] || 'server';
	const sample = process.argv[3] ? Number(process.argv[3]) : undefined;
	const level = process.argv[4];
	const params = { subject };
	if (sample !== undefined) params.sample = sample;
	if (level) params.level = level;

	const wsUrl = process.env.MNEM_WS_URL || 'ws://127.0.0.1:9231';
	const ws = new WebSocket(wsUrl);
	await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
	const answer = await new Promise((resolve, reject) => {
		ws.on('message', (raw) => {
			const msg = JSON.parse(raw.toString());
			if (msg.id === 42) resolve(msg);
		});
		ws.send(JSON.stringify({ jsonrpc: '2.0', id: 42, method: 'state/query', params }));
		setTimeout(() => reject(new Error('timeout')), 8000);
	});
	console.log(JSON.stringify(answer, null, 1));
	ws.close();
	process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
