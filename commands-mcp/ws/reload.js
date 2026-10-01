/**
 * MCP Tool Metadata:
 * {
 *   "name": "ws_reload",
 *   "description": "Reload ONE module in the running target with compiled JS (Mode 2, option a): the code is compiled under the module's real filename (?v=N so DevTools lists each reload separately), mnemonica define/registerHook are intercepted during that evaluation — existing type paths keep the SAME type object with only the handler swapped, hooks the module re-registers REPLACE its previous ones — then the old module.exports object is replaced IN PLACE. In-flight requests finish on old code; the next request runs new. The entry module is refused (that is a full restart). CommonJS only.",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "module": {
 *         "type": "string",
 *         "description": "The built file's path in the running app (as it appears in require.cache)"
 *       },
 *       "code": {
 *         "type": "string",
 *         "description": "The compiled JS of that one module (compile locally with the app's tsconfig — inlineSourceMap+inlineSources so DevTools still shows the TS)"
 *       }
 *     },
 *     "required": ["module", "code"]
 *   },
 *   "examples": [
 *     {
 *       "description": "Reload a nested module into the running target",
 *       "args": { "module": "/app/dist/user/user.service.js", "code": "'use strict'; ... compiled JS ..." }
 *     }
 *   ]
 * }
 */

// Runs in the MCP process; the effect crosses the WS channel into the target.

async function run (ctx) {
	const store = ctx.store;
	const args = ctx.args || {};

	let commandArgs = args;
	if (args.message && typeof args.message === 'string') {
		try {
			commandArgs = JSON.parse(args.message);
		} catch (e) {}
	}

	const channel = (store && store instanceof Map) ? store.get('ws') : null;
	if (!channel || !channel.session) {
		return { success: false, error: 'No WS session — run ws_bootstrap first' };
	}

	try {
		const result = await channel.session.request('reload', {
			module: commandArgs.module,
			code: commandArgs.code,
		});
		return { success: true, result };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

module.exports = { run };
