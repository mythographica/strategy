/**
 * MCP Tool Metadata:
 * {
 *   "name": "say_hi",
 *   "description": "Say Hi to NestJS server via CDP - logs to NestJS console",
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

// Simple command to prove CDP connection to NestJS
// This logs directly to the NestJS server console

// Extract ctx from global scope (passed by CDP execution context)
var { args } = ctx;

// Parse message if it exists
if (args.message && typeof args.message === 'string') {
	try {
		var parsed = JSON.parse(args.message);
		args = parsed;
	} catch (e) {
		// keep original args
	}
}

var name = args.name || 'Roo';

// Log to NestJS console - this will appear in NestJS logs
console.log('HI, ' + name + '!');
console.log('  -> This message was sent via CDP from Strategy MCP');
console.log('  -> Timestamp: ' + new Date().toISOString());

return {
	success: true,
	message: 'Said hi to NestJS server',
	name: name,
	logged: true,
	timestamp: Date.now(),
	evidence: 'Check NestJS server logs for the HI message!'
};
