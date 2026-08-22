/**
 * MCP Tool Metadata:
 * {
 *   "name": "ws_instantiate",
 *   "description": "Construct an instance of any type in the runtime over the WS channel. Returns a depth-capped, circular-safe summary of the instance — never a whole serialization.",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "path": {
 *         "type": "string",
 *         "description": "Full type path (e.g. UserEntity or TempProbe.Named)"
 *       },
 *       "args": {
 *         "type": "array",
 *         "description": "Constructor arguments for the LEAF type (JSON-serializable)"
 *       },
 *       "chainArgs": {
 *         "type": "object",
 *         "description": "Args for intermediate chain levels, keyed by prefix path — mnemonica subtypes construct from parent INSTANCES, e.g. { \"TempProbe\": [{ \"value\": 7 }] }"
 *       }
 *     },
 *     "required": ["path"]
 *   },
 *   "examples": [
 *     {
 *       "description": "Instantiate a root type with one data argument",
 *       "args": { "path": "TempProbe", "args": [{ "value": 42 }] }
 *     },
 *     {
 *       "description": "Instantiate a nested subtype (parent chain built from chainArgs)",
 *       "args": { "path": "TempProbe.Named", "args": [{ "label": "deep" }], "chainArgs": { "TempProbe": [{ "value": 7 }] } }
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
		const result = await channel.session.request('instantiate', {
			path: commandArgs.path,
			args: commandArgs.args,
			chainArgs: commandArgs.chainArgs,
		});
		return { success: true, result };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

module.exports = { run };
