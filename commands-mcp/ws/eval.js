/**
 * MCP Tool Metadata:
 * {
 *   "name": "ws_eval",
 *   "description": "Evaluate an expression in the target runtime over the WS channel. The expression is awaited and has `mnemonica` and the session `registry` in scope. Escape hatch — prefer the dedicated ops.",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "expression": {
 *         "type": "string",
 *         "description": "JS expression, evaluated as (async () => (EXPR))() in the target"
 *       }
 *     },
 *     "required": ["expression"]
 *   },
 *   "examples": [
 *     {
 *       "description": "List registered type names from the default collection",
 *       "args": { "expression": "Array.from(mnemonica.defaultCollection.keys())" }
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
		const result = await channel.session.request('eval', {
			expression: commandArgs.expression,
		});
		return { success: true, result };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

module.exports = { run };
