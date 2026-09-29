/**
 * MCP Tool Metadata:
 * {
 *   "name": "ws_patch",
 *   "description": "Replace the construct handler of an EXISTING mnemonica type in the running target, in flight (live patch). The constructor identity never changes — captured references and previously built instances keep working; the NEXT construction runs the new handler. The original factory is saved for ws_rollback. Works for root and subtype paths of the app's own types (not only session-born ws_define types).",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "path": {
 *         "type": "string",
 *         "description": "Full type path in the target's registry (e.g. UserEntity or UserEntity.AdminEntity)"
 *       },
 *       "body": {
 *         "type": "string",
 *         "description": "New construct handler source (a function expression)"
 *       }
 *     },
 *     "required": ["path", "body"]
 *   },
 *   "examples": [
 *     {
 *       "description": "Patch a type's handler for the next constructions",
 *       "args": { "path": "UserEntity", "body": "function (data) { this.name = data.name.toUpperCase(); }" }
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
		const result = await channel.session.request('patch', {
			path: commandArgs.path,
			body: commandArgs.body,
		});
		return { success: true, result };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

module.exports = { run };
