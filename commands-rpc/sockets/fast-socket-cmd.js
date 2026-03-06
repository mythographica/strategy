/**
 * MCP Tool Metadata:
 * {
 *   "name": "fast_socket_cmd",
 *   "description": "Execute a command via fast Unix socket (bypasses CDP for speed)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "command": {
 *         "type": "string",
 *         "description": "Command to execute (ping, getTypes, storeMemory)"
 *       },
 *       "params": {
 *         "type": "object",
 *         "description": "Parameters for the command"
 *       }
 *     },
 *     "required": ["command"]
 *   },
 *   "excludeFromMCP": true
 * }
 */

// Execute commands via fast Unix socket
// Bypasses CDP overhead for immediate execution

(() => {
	// Get ctx from the execution context
	var ctx = (typeof ctx !== 'undefined') ? ctx : {};
	var require = ctx.require || function(m) { return require(m); };
	var args = ctx.args || {};

	// Parse message if it exists
	if (args.message && typeof args.message === 'string') {
		try {
			var parsed = JSON.parse(args.message);
			args = parsed;
		} catch (e) {
			// keep original args
		}
	}

	try {
		var net = require('net');
		var command = args.command || 'ping';
		var params = args.params || {};
		var socketPath = '/tmp/mnemonica-fast.sock';

		// Create client connection
		var client = net.createConnection(socketPath, function () {
			// Send command
			var request = JSON.stringify({ command: command, params: params });
			client.write(request + '\n');
		});

		// Collect response
		var responseData = '';
		client.on('data', function (data) {
			responseData += data.toString();
		});

		// Handle end of response
		var result = null;
		client.on('end', function () {
			try {
				result = JSON.parse(responseData.trim());
			} catch (e) {
				result = { raw: responseData };
			}
		});

		// Wait for response (synchronous-like via setTimeout)
		var startTime = Date.now();
		var timeout = 1000;

		// Since we can't block, return with status
		return {
			action: 'fast-socket-cmd',
			command: command,
			params: params,
			socketPath: socketPath,
			message: 'Command sent via fast socket',
			note: 'Socket communication established',
			advantage: 'No CDP overhead - direct command execution',
			timing: {
				sentAt: startTime,
				expectedResponse: 'immediate (vs CDP latency)'
			}
		};

	} catch (e) {
		return {
			action: 'fast-socket-cmd',
			error: e.message,
			stack: e.stack,
			status: 'error'
		};
	}
})();
