/**
 * MCP Tool Metadata:
 * {
 *   "name": "cdp_create_type",
 *   "description": "Create a Mnemonica type in NestJS via CDP",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "typeName": {
 *         "type": "string",
 *         "description": "Name of the type to create"
 *       }
 *     },
 *     "required": ["typeName"]
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

	const typeName = commandArgs.typeName;
	if (!typeName) {
		return { success: false, error: 'typeName is required' };
	}

	const cdpData = (store && store instanceof Map) ? store.get('cdp') : null;
	if (!cdpData || !cdpData.isConnected) {
		return { success: false, error: 'No CDP connection' };
	}

	try {
		const fs = require('fs');
		const path = require('path');
		
		// Read CDP script (no metadata, no IIFE, just code)
		const scriptPath = path.join(__dirname, '../cdp-scripts/create-type.js');
		let script = fs.readFileSync(scriptPath, 'utf-8');
		
		// Inject args
		script = 'var args = ' + JSON.stringify({ typeName: typeName }) + ';\n' + script;
		
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
