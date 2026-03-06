/**
 * MCP Tool Metadata:
 * {
 *   "name": "say_hi_nestjs",
 *   "description": "Say Hi to NestJS server via CDP - executes console.log in NestJS runtime",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "name": {
 *         "type": "string",
 *         "description": "Name to say hi to (default: Roo)"
 *       }
 *     }
 *   }
 * }
 */

// MCP Orchestration Command
// Executes console.log directly in NestJS runtime via CDP

async function run (ctx) {
	const store = ctx.store;
	const args = ctx.args || {};

	// Parse message if it exists
	let commandArgs = args;
	if (args.message && typeof args.message === 'string') {
		try {
			commandArgs = JSON.parse(args.message);
		} catch (e) {
			// keep original args
		}
	}

	const name = commandArgs.name || 'Roo';

	// Check for CDP connection
	const cdpData = (store && store instanceof Map) ? store.get('cdp') : null;
	const hasCDP = cdpData && cdpData.isConnected && cdpData.connection;

	if (!hasCDP) {
		return {
			success: false,
			error: 'No CDP connection to NestJS runtime',
			message: 'Cannot say hi - CDP not connected. Connect first with connection command.'
		};
	}

	try {
		// Build code to execute in NestJS runtime
		// Test: return 2+2 to verify CDP returns values
		const codeToExecute = `
			console.log('=== TESTING CDP RETURN ===');
			console.log('HI, ${name}!');
			console.log('Process PID: ' + process.pid);
			console.log('==========================');
			({ success: true, value: 2 + 2, source: 'NestJS' })
		`;

		// Execute via CDP in NestJS runtime
		const client = cdpData.connection;
		const result = await client.Runtime.evaluate({
			expression: codeToExecute,
			returnByValue: true,
			awaitPromise: true
		});

		if (result.exceptionDetails) {
			return {
				success: false,
				error: result.exceptionDetails.exception?.description || 'Unknown CDP error',
				message: 'Failed to execute in NestJS runtime'
			};
		}

		return {
			success: true,
			message: 'Successfully said hi to NestJS server via CDP!',
			name: name,
			target: 'NestJS runtime console',
			evidence: 'Check NestJS server terminal/logs for the "=== HI FROM STRATEGY MCP ===" message!',
			cdpResult: result.result?.value
		};

	} catch (e) {
		return {
			success: false,
			error: e.message,
			message: 'Error executing via CDP'
		};
	}
}

module.exports = { run };
