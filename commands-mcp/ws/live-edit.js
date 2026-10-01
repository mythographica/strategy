/**
 * MCP Tool Metadata:
 * {
 *   "name": "ws_live_edit",
 *   "description": "Edit a running module's script IN PLACE via Debugger.setScriptSource (Mode 2, option b) — reaches even references a ws_reload cannot (true destructured require-bindings). V8 live-edit rules apply: the edit must keep the script's structural positions (a one-function body/signature change), and V8 REFUSES while a request is suspended in the old function — the refusal (e.g. BlockedByActiveGenerator) is returned verbatim. After reloads, the newest ?v=N script is targeted. Use ws_reload for structural rewrites.",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "module": {
 *         "type": "string",
 *         "description": "The built file's path in the running app"
 *       },
 *       "code": {
 *         "type": "string",
 *         "description": "The full new source of that compiled file (shape-preserving edit)"
 *       }
 *     },
 *     "required": ["module", "code"]
 *   },
 *   "examples": [
 *     {
 *       "description": "Live-edit one function in a running module",
 *       "args": { "module": "/app/dist/user/user.service.js", "code": "'use strict'; ... shape-preserving compiled JS ..." }
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
		const result = await channel.session.request('liveEdit', {
			module: commandArgs.module,
			code: commandArgs.code,
		});
		return { success: true, result };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

module.exports = { run };
