const { createRequire } = require('node:module');
const req = createRequire('/code/mnemonica/strategy/lib/server.js');
const CDP = req('chrome-remote-interface');
(async () => {
	const targets = await CDP.List({ port: 9223 });
	const iframe = targets.find(t => t.type === 'iframe' && /vscode-webview/.test(t.url || ''));
	const client = await CDP({ port: 9223, target: iframe.id });
	await client.Runtime.enable();
	const result = await client.Runtime.evaluate({ expression: process.argv[2], awaitPromise: true, returnByValue: true });
	if (result.exceptionDetails) { console.error('EXC:', result.exceptionDetails.text, result.exceptionDetails.exception?.description || ''); process.exit(1); }
	console.log(JSON.stringify(result.result.value, null, 2));
	await client.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
