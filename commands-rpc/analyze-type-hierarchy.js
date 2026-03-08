/**
 * MCP Tool Metadata:
 * {
 *   "name": "cdp_analyze_type_hierarchy",
 *   "description": "Analyze Mnemonica type hierarchy in NestJS via CDP",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

async function run (ctx) {
	const store = ctx.store;
	const require = ctx.require;

	const cdpData = (store && store instanceof Map) ? store.get('cdp') : null;
	if (!cdpData || !cdpData.isConnected) {
		return { success: false, error: 'No CDP connection' };
	}

	try {
		const fs = require('fs');
		const path = require('path');

		// Read CDP script (no metadata, no IIFE, just code)
		// Fixed path: from commands-rpc/ go up to strategy/ then to cdp-scripts/
		const scriptPath = path.join(__dirname, '../cdp-scripts/analyze-hierarchy.js');
		let script = fs.readFileSync(scriptPath, 'utf-8');

		// Inject empty args
		script = 'var args = {};\n' + script;

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
