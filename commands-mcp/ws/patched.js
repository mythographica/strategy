/**
 * MCP Tool Metadata:
 * {
 *   "name": "ws_patched",
 *   "description": "List the types live-patched in this session (ws_patch): each path with its patch count and last patch time. Nothing here means the released code runs everywhere.",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "examples": [
 *     {
 *       "description": "Show all live-patched types",
 *       "args": {}
 *     }
 *   ]
 * }
 */

// Runs in the MCP process; the effect crosses the WS channel into the target.

async function run (ctx) {
	const store = ctx.store;

	const channel = (store && store instanceof Map) ? store.get('ws') : null;
	if (!channel || !channel.session) {
		return { success: false, error: 'No WS session — run ws_bootstrap first' };
	}

	try {
		const result = await channel.session.request('patched', {});
		return { success: true, result };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

module.exports = { run };
