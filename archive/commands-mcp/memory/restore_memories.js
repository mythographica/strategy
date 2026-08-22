/**
 * MCP Tool Metadata:
 * {
 *   "name": "restore_memories",
 *   "description": "Restore AI memories - orchestrates RPC then RUN fallback",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "path": {
 *         "type": "string",
 *         "description": "Directory path to the memories file (default: /code/mnemonica/tactica-examples/nestjs)"
 *       },
 *       "filename": {
 *         "type": "string",
 *         "description": "Filename to restore from (default: ai-memories.json)"
 *       }
 *     }
 *   }
 * }
 */

// MCP Orchestration Command
// 1. Try RPC (remote execution in NestJS)
// 2. If RPC unavailable or fails, fallback to RUN (local filesystem)


const require = ctx.require || function(m) { return(m); };
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

// Configurable parameters with defaults
const basePath = commandArgs.path || '/code/mnemonica/tactica-examples/nestjs';
const filename = commandArgs.filename || 'ai-memories.json';
const filePath = path.join(basePath, filename);

// Step 1: Check for CDP connection
const cdpData = (store && store instanceof Map) ? store.get('cdp') : null;
const hasCDP = cdpData && cdpData.isConnected && cdpData.connection;

// Orchestration result
const result = {
	orchestration: true,
	path: filePath,
	attempts: [],
	success: false
};

// Step 2: Try RPC if CDP available
if (hasCDP) {
	result.attempts.push({ tier: 'RPC', status: 'attempting' });
	
	try {
		// Read RPC command file
		// Use hardcoded path since __dirname is not available in new Function() context
		const rpcFilePath = '/code/mnemonica/strategy/commands-remote/memory/restore-memories.js';
		const rpcCode = fs.readFileSync(rpcFilePath, 'utf-8');
		
		// Remove metadata for clean execution
		const cleanCode = rpcCode.replace(/\/\*\*[\s\S]*?\*\//, '').trim();
		
		// Build the execution context for CDP
		// The RPC command expects 'ctx' with 'require' and 'args'
		// Wrap ENTIRE code in async IIFE - return statements must be inside a function
		// Use global.require since we're in the remote runtime context
		const codeToExecute = `(async function() {
			var ctx = {
				require: global.require,
				args: ${JSON.stringify({ path: basePath, filename: filename })}
			};
			${cleanCode}
		})()`;
		
		// Execute via CDP
		const client = cdpData.connection;
		const rpcResult = await client.Runtime.evaluate({
			expression: codeToExecute,
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
				result.message = 'Memories restored via RPC (remote execution)';
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
	// Use hardcoded path since __dirname is not available in new Function() context
	const runFilePath = '/code/mnemonica/strategy/commands-run/memory/restore_memories.js';
	const runCommand = require(runFilePath);
	
	if (typeof runCommand.run === 'function') {
		const runResult = runCommand.run({
			require: require,
			args: { path: basePath, filename: filename },
			store: store
		});
		
		if (runResult.success) {
			result.attempts.push({ tier: 'RUN', status: 'success' });
			result.success = true;
			result.data = runResult;
			result.message = 'Memories restored via RUN (local fallback)';
			result.note = 'RPC was unavailable, used local fallback';
		} else {
			result.attempts.push({ 
				tier: 'RUN', 
				status: 'failed',
				error: runResult.error
			});
			result.message = 'Both RPC and RUN failed to restore memories';
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
