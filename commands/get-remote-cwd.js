/**
 * MCP Tool Metadata:
 * {
 *   "name": "get_remote_cwd",
 *   "description": "Get the current working directory (process.cwd()) from the remote Node.js runtime",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

// This script runs in the remote Node.js runtime to get process.cwd()

(() => {
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
