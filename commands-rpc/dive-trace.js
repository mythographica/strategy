/**
 * MCP Tool Metadata:
 * {
 *   "name": "rpc_dive_trace",
 *   "description": "Dump the target runtime's dive execution-flow trace (JSON-safe edges) via CDP",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "sinceId": {
 *         "type": "number",
 *         "description": "Optional: keep only edges with id greater than this (polling delta)"
 *       }
 *     }
 *   }
 * }
 */

async function run (ctx) {
	const store = ctx.store;
	const require = ctx.require;
	const args = ctx.args || {};

	let commandArgs = args;
	if (args.message && typeof args.message === 'string') {
		try {
			commandArgs = JSON.parse(args.message);
		} catch (e) {}
	}

	const cdpData = (store && store instanceof Map) ? store.get('cdp') : null;
	if (!cdpData || !cdpData.isConnected) {
		return { success: false, error: 'No CDP connection' };
	}

	try {
		const fs = require('fs');
		const path = require('path');

		// Read CDP script (no metadata, no IIFE, just code)
		// Fixed path: from commands-rpc/ go up to strategy/ then to cdp-scripts/
		const scriptPath = path.join(__dirname, '../cdp-scripts/dive-trace.js');
		let script = fs.readFileSync(scriptPath, 'utf-8');

		// Inject args
		const scriptArgs = {};
		if (typeof commandArgs.sinceId === 'number') {
			scriptArgs.sinceId = commandArgs.sinceId;
		}
		script = 'var args = ' + JSON.stringify(scriptArgs) + ';\n' + script;

		const client = cdpData.connection;
		const result = await client.Runtime.evaluate({
			expression: script,
			returnByValue: true,
			awaitPromise: true
		});

		if (result.exceptionDetails) {
			return { success: false, error: result.exceptionDetails.exception?.description };
		}

		return {
			success: true,
			executedIn: 'NestJS via CDP',
			result: result.result?.value
		};

	} catch (e) {
		return { success: false, error: e.message };
	}
}

module.exports = { run };
