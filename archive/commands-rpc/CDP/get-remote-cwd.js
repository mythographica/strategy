/**
 * MCP Tool Metadata:
 * {
 *   "name": "get_remote_cwd",
 *   "description": "Get the current working directory (process.cwd()) from the remote Node.js runtime",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "excludeFromMCP": true
 * }
 */

// This script runs in the remote Node.js runtime to get process.cwd()

(() => {
	// Get ctx from the execution context
	var ctx = (typeof ctx !== 'undefined') ? ctx : {};
	var require = ctx.require || function(m) { return require(m); };
	var args = ctx.args || {};

	// Parse message if it exists
	if (args.message && typeof args.message === 'string') {
		try {
			var parsed = JSON.parse(args.message);
			args = parsed;
		} catch (e) {
			// keep original args
		}
	}

	try {
		var cwd = process.cwd();
		var mainModule = process.mainModule ? process.mainModule.filename : null;
		
		return {
			cwd: cwd,
			mainModule: mainModule,
			platform: process.platform,
			version: process.version,
		};
	} catch (e) {
		return { error: e.message, stack: e.stack };
	}
})()
