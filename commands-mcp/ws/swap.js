/**
 * MCP Tool Metadata:
 * {
 *   "name": "ws_swap",
 *   "description": "Replace the constructor handler behind a session-defined type, in flight. The constructor identity mnemonica holds never changes — only the impl behind the shim. Refuses types not born via ws_define.",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "path": {
 *         "type": "string",
 *         "description": "Full type path as defined in this session (e.g. TempProbe or TempProbe.Named)"
 *       },
 *       "body": {
 *         "type": "string",
 *         "description": "New constructor handler source"
 *       }
 *     },
 *     "required": ["path", "body"]
 *   },
 *   "examples": [
 *     {
 *       "description": "Swap a type's handler for a new implementation",
 *       "args": { "path": "TempProbe", "body": "function (data) { this.value = data.value * 2; }" }
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
		const result = await channel.session.request('swap', {
			path: commandArgs.path,
			body: commandArgs.body,
		});
		return { success: true, result };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

module.exports = { run };
