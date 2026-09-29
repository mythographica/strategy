/**
 * MCP Tool Metadata:
 * {
 *   "name": "ws_rollback",
 *   "description": "Restore the original construct handler of a live-patched type (ws_patch), exactly as it was before the first patch this session. With { all: true } rolls back every patched path. After a rollback the type behaves as released; a fresh ws_patch starts saving a new original.",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "path": {
 *         "type": "string",
 *         "description": "Full type path to roll back (e.g. UserEntity.AdminEntity)"
 *       },
 *       "all": {
 *         "type": "boolean",
 *         "description": "Roll back every patched path"
 *       }
 *     }
 *   },
 *   "examples": [
 *     {
 *       "description": "Roll back one patched type",
 *       "args": { "path": "UserEntity" }
 *     },
 *     {
 *       "description": "Roll back all patched types",
 *       "args": { "all": true }
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
		const result = await channel.session.request('rollback', {
			path: commandArgs.path,
			all: !!commandArgs.all,
		});
		return { success: true, result };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

module.exports = { run };
