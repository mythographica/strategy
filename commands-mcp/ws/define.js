/**
 * MCP Tool Metadata:
 * {
 *   "name": "ws_define",
 *   "description": "Define a new Mnemonica type in the runtime over the WS channel. The type is born shimmed: its constructor is a stable shell whose handler can later be replaced via ws_swap.",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "name": {
 *         "type": "string",
 *         "description": "Name of the type to define"
 *       },
 *       "parentPath": {
 *         "type": "string",
 *         "description": "Optional parent type path (e.g. UserEntity) — defines a subtype under it"
 *       },
 *       "body": {
 *         "type": "string",
 *         "description": "Constructor handler source, e.g. \"function (data) { this.name = data.name; }\" — classic, async, or arrow function source"
 *       },
 *       "config": {
 *         "type": "object",
 *         "description": "Optional define() config (strictMode, etc.)"
 *       }
 *     },
 *     "required": ["name", "body"]
 *   },
 *   "examples": [
 *     {
 *       "description": "Define a root type",
 *       "args": { "name": "TempProbe", "body": "function (data) { this.value = data.value; }" }
 *     },
 *     {
 *       "description": "Define a subtype under an existing type",
 *       "args": { "name": "Named", "parentPath": "TempProbe", "body": "function (data) { this.label = data.label; }" }
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
		const result = await channel.session.request('define', {
			name: commandArgs.name,
			parentPath: commandArgs.parentPath,
			body: commandArgs.body,
			config: commandArgs.config,
		});
		return { success: true, result };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

module.exports = { run };
