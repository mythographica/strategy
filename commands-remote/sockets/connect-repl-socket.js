/**
 * MCP Tool Metadata:
 * {
 *   "name": "connect_repl_socket",
 *   "description": "Connect to REPL socket and execute a command (runs locally in MCP)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "socketPath": {
 *         "type": "string",
 *         "description": "Path to Unix domain socket"
 *       },
 *       "command": {
 *         "type": "string",
 *         "description": "Command to execute (if empty, interactive mode)"
 *       },
 *       "timeout": {
 *         "type": "number",
 *         "description": "Timeout in ms"
 *       }
 *     }
 *   },
 *   "excludeFromMCP": true
 * }
 */

// Connect to a REPL socket and execute a command
// This runs LOCALLY in the MCP server to connect to the NestJS app's REPL socket

'use strict';

const net = require('net');
const fs = require('fs');

async function connectREPLSocket (args) {
	const socketPath = args.socketPath || '/tmp/mnemonica-repl.sock';
	const command = args.command || '';
	const timeout = args.timeout || 5000;

	// Check if socket file exists
	if (!fs.existsSync(socketPath)) {
		return {
			success: false,
			error: 'Socket file not found: ' + socketPath
		};
	}

	return new Promise((resolve) => {
		const socket = net.createConnection(socketPath);
		let buffer = '';
		let timer = null;
		let resolved = false;

		const result = {
			success: true,
			socketPath: socketPath
		};

		socket.on('connect', () => {
			if (command) {
				// Send command and exit
				socket.write(command + '\n');
				socket.write('.exit\n');
			} else {
				// Interactive mode - just report connection
				result.message = 'Connected to REPL socket (interactive mode)';
				result.mode = 'interactive';
				resolved = true;
				socket.end();
			}
		});

		socket.on('data', (data) => {
			buffer += data.toString();
		});

		socket.on('close', () => {
			if (!resolved) {
				result.message = 'REPL session closed';
				result.output = buffer;
				resolved = true;
			}
			if (timer) {
				clearTimeout(timer);
			}
			resolve(result);
		});

		socket.on('error', (err) => {
			if (!resolved) {
				result.success = false;
				result.error = 'Socket error: ' + err.message;
				resolved = true;
			}
			if (timer) {
				clearTimeout(timer);
			}
			resolve(result);
		});

		// Timeout
		timer = setTimeout(() => {
			if (!resolved) {
				socket.destroy();
				result.message = 'REPL command timed out';
				result.output = buffer;
				resolved = true;
				resolve(result);
			}
		}, timeout);
	});
}

// Export for local execution via dynamic_tool
module.exports = { run: connectREPLSocket };

// Also support direct IIFE execution for remote
if (typeof _toolArgs !== 'undefined') {
	module.exports = connectREPLSocket(_toolArgs);
}
