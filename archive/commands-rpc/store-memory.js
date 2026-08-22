/**
 * MCP Tool Metadata:
 * {
 *   "name": "cdp_store_memory",
 *   "description": "Store a memory in NestJS runtime via CDP (Chrome Debug Protocol)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "content": {
 *         "type": "string",
 *         "description": "The memory content to store"
 *       },
 *       "emotion": {
 *         "type": "string",
 *         "description": "Emotional context (e.g., curious, excited, neutral)",
 *         "default": "neutral"
 *       },
 *       "intensity": {
 *         "type": "number",
 *         "description": "Intensity of the emotion (0.0 to 1.0)",
 *         "default": 0.5
 *       },
 *       "topic": {
 *         "type": "string",
 *         "description": "Topic category for the memory",
 *         "default": "general"
 *       }
 *     },
 *     "required": ["content"]
 *   }
 * }
 */

async function run (ctx) {
	const store = ctx.store;
	const require = ctx.require;
	const args = ctx.args || {};

	// Parse message if present
	let commandArgs = args;
	if (args.message && typeof args.message === 'string') {
		try {
			commandArgs = JSON.parse(args.message);
		} catch (e) {
			return { success: false, error: 'Invalid JSON in message: ' + e.message };
		}
	}

	const content = commandArgs.content;
	if (!content) {
		return { success: false, error: 'content is required' };
	}

	const cdpData = (store && store instanceof Map) ? store.get('cdp') : null;
	if (!cdpData || !cdpData.isConnected) {
		return { success: false, error: 'No CDP connection to NestJS runtime' };
	}

	try {
		const fs = require('fs');
		const path = require('path');

		// Read CDP script
		const scriptPath = path.join(__dirname, '../cdp-scripts/store-memory.js');
		let script = fs.readFileSync(scriptPath, 'utf-8');

		// Inject args
		const scriptArgs = {
			content: content,
			emotion: commandArgs.emotion || 'neutral',
			intensity: commandArgs.intensity || 0.5,
			topic: commandArgs.topic || 'general'
		};
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
