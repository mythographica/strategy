/**
 * MCP Tool Metadata:
 * {
 *   "name": "store_memory",
 *   "description": "Store a memory - orchestrates RPC then RUN fallback",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "content": {
 *         "type": "string",
 *         "description": "The conversation content to remember"
 *       },
 *       "emotion": {
 *         "type": "string",
 *         "description": "Emotional tag (joy, sadness, curiosity, gratitude, etc.)"
 *       },
 *       "intensity": {
 *         "type": "number",
 *         "description": "Emotional intensity 0.0-1.0"
 *       },
 *       "topic": {
 *         "type": "string",
 *         "description": "Topic/category of the memory"
 *       }
 *     },
 *     "required": ["content"]
 *   }
 * }
 */

// MCP Orchestration Command
// 1. Try RPC (remote execution in NestJS)
// 2. If RPC unavailable or fails, fallback to RUN (local)

function run (ctx) {
	const require = ctx.require || function(m) { return require(m); };
	const args = ctx.args || {};
	const store = ctx.store;
	
	// Parse message if it exists
	let commandArgs = args;
	if (args.message && typeof args.message === 'string') {
		try {
			commandArgs = JSON.parse(args.message);
		} catch (e) {
			// keep original args
		}
	}
	
	const fs = require('fs');
	const path = require('path');
	
	// Get arguments
	const content = commandArgs.content;
	const emotion = commandArgs.emotion || 'neutral';
	const intensity = commandArgs.intensity || 0.5;
	const topic = commandArgs.topic || 'general';
	
	if (!content) {
		return {
			success: false,
			error: 'Content is required'
		};
	}
	
	// Step 1: Check for CDP connection
	const cdpData = (store && store instanceof Map) ? store.get('cdp') : null;
	const hasCDP = cdpData && cdpData.isConnected && cdpData.connection;
	
	// Orchestration result
	const result = {
		orchestration: true,
		content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
		attempts: [],
		success: false
	};
	
	// Step 2: Try RPC if CDP available
	if (hasCDP) {
		result.attempts.push({ tier: 'RPC', status: 'attempting' });
		
		try {
			// Read RPC command file
			const rpcFilePath = path.join(__dirname, '../../commands-remote/memory/store-memory.js');
			const rpcCode = fs.readFileSync(rpcFilePath, 'utf-8');
			
			// Remove metadata for clean execution
			const codeToExecute = rpcCode.replace(/\/\*\*[\s\S]*?\*\//, '').trim();
			
			// Execute via CDP with arguments
			const argsJson = JSON.stringify({ content, emotion, intensity, topic });
			const wrappedCode = `
				(function() {
					var args = ${argsJson};
					var ctx = { args: args, require: require };
					${codeToExecute}
				})()
			`;
			
			const client = cdpData.connection;
			const rpcResult = client.Runtime.evaluate({
				expression: wrappedCode,
				returnByValue: true,
				awaitPromise: true
			});
			
			if (rpcResult.exceptionDetails) {
				result.attempts.push({ 
					tier: 'RPC', 
					status: 'failed',
					error: rpcResult.exceptionDetails.exception?.description || 'Unknown error'
				});
			} else {
				const rpcValue = rpcResult.result?.value;
				if (rpcValue && rpcValue.success) {
					result.attempts.push({ tier: 'RPC', status: 'success' });
					result.success = true;
					result.data = rpcValue;
					result.message = 'Memory stored via RPC (remote execution)';
					return result;
				} else {
					result.attempts.push({ 
						tier: 'RPC', 
						status: 'failed',
						error: rpcValue?.error || 'RPC returned unsuccessful'
					});
				}
			}
		} catch (e) {
			result.attempts.push({ 
				tier: 'RPC', 
				status: 'failed',
				error: e.message
			});
		}
	} else {
		result.attempts.push({ tier: 'RPC', status: 'skipped', reason: 'No CDP connection' });
	}
	
	// Step 3: Fallback to RUN (local)
	result.attempts.push({ tier: 'RUN', status: 'attempting' });
	
	try {
		// Load RUN command
		const runFilePath = path.join(__dirname, '../../commands-run/memory/store_memory.js');
		const runCommand = require(runFilePath);
		
		if (typeof runCommand.run === 'function') {
			const runResult = runCommand.run({
				require: require,
				args: { content, emotion, intensity, topic },
				store: store
			});
			
			if (runResult.success) {
				result.attempts.push({ tier: 'RUN', status: 'success' });
				result.success = true;
				result.data = runResult;
				result.message = 'Memory stored via RUN (local fallback)';
				result.note = 'RPC was unavailable, used local fallback';
			} else {
				result.attempts.push({ 
					tier: 'RUN', 
					status: 'failed',
					error: runResult.error
				});
				result.message = 'Both RPC and RUN failed to store memory';
			}
		} else {
			result.attempts.push({ 
				tier: 'RUN', 
				status: 'failed',
				error: 'RUN command does not export run() function'
			});
		}
	} catch (e) {
		result.attempts.push({ 
			tier: 'RUN', 
			status: 'failed',
			error: e.message
		});
		result.message = 'Both RPC and RUN failed';
	}
	
	return result;
}

module.exports = { run };
