/**
 * MCP Tool Metadata:
 * {
 *   "name": "ws_session",
 *   "description": "Inspect or close the WS construction channel: status (local handle state), list (session-defined swappable types in the target), close (tear the channel down)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "action": {
 *         "type": "string",
 *         "enum": ["status", "list", "close"],
 *         "description": "Session action (default: status)"
 *       }
 *     }
 *   },
 *   "examples": [
 *     {
 *       "description": "Show local channel state",
 *       "args": { "action": "status" }
 *     },
 *     {
 *       "description": "List swappable types defined in this session",
 *       "args": { "action": "list" }
 *     }
 *   ]
 * }
 */

// Runs in the MCP process against the stored WS channel handle.

async function run (ctx) {
	const store = ctx.store;
	const args = ctx.args || {};

	let commandArgs = args;
	if (args.message && typeof args.message === 'string') {
		try {
			commandArgs = JSON.parse(args.message);
		} catch (e) {}
	}

	const action = commandArgs.action || 'status';
	const channel = (store && store instanceof Map) ? store.get('ws') : null;

	if (action === 'status') {
		if (!channel || !channel.session) {
			return { success: true, connected: false, note: 'No WS session — run ws_bootstrap to open one' };
		}
		return {
			success: true,
			connected: channel.session.isOpen,
			port: channel.port,
			pid: channel.pid,
			connectedAt: channel.connectedAt,
			welcome: channel.session.welcome,
		};
	}

	if (!channel || !channel.session) {
		return { success: false, error: 'No WS session — run ws_bootstrap first' };
	}

	try {
		if (action === 'list') {
			const result = await channel.session.request('list');
			return { success: true, result };
		}
		if (action === 'close') {
			channel.session.close();
			if (store && store instanceof Map) {
				store.delete('ws');
			}
			return { success: true, closed: true, note: 'WS channel closed; the in-target server keeps listening — re-run ws_bootstrap to reconnect' };
		}
		return { success: false, error: 'Unknown action: "' + action + '" (status | list | close)' };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

module.exports = { run };
