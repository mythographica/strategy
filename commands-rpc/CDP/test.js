/**
 * MCP Tool Metadata:
 * {
 *   "name": "test",
 *   "description": "Test command to verify args passing - returns third argument back",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "action": {
 *         "type": "string",
 *         "enum": ["test"],
 *         "description": "Action to perform (should be 'test')"
 *       },
 *       "host": {
 *         "type": "string",
 *         "description": "Host to test (default: localhost)"
 *       },
 *       "port": {
 *         "type": "number",
 *         "description": "Port to test (default: 9229) - third argument"
 *       }
 *     }
 *   },
 *   "examples": [
 *     {
 *       "description": "Test with custom third arg",
 *       "args": { "action": "test", "host": "localhost", "port": 12345 }
 *     }
 *   ]
 * }
 */

var { require, args, store } = ctx;

var debug = [];
debug.push('ctx.args type: ' + typeof args);
debug.push('ctx.args keys: ' + (args ? Object.keys(args).join(',') : 'null'));
debug.push('ctx.args: ' + JSON.stringify(args));

// Extract the three arguments (same as connection command)
var action = args.action;
var host = args.host || 'localhost';
var port = args.port || 9229;

debug.push('action: ' + action);
debug.push('host: ' + host);
debug.push('port: ' + port);

// Return the third argument (port) back to verify args were passed
return {
	success: true,
	message: 'Test command executed',
	receivedArgs: {
		action: action,
		host: host,
		port: port
	},
	// The third argument - if this is empty/null/default, args weren't passed correctly
	thirdArg: port,
	debug: debug,

	Received_CTX: ctx,

	time: Date.now(),
};
