/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_tcp_server_type",
 *   "description": "Create a Mnemonica type that starts a TCP server on port 9227",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "excludeFromMCP": true
 * }
 */

// This script creates a type that starts a TCP server on port 9227
// Uses built-in 'net' module (no external dependencies)

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
		var mnemonica = require('mnemonica');

		process._rawDebug('[create-tcp-server-type] Starting...');

		// Get SyncBase using lookup
		var SyncBase = mnemonica.defaultTypes.lookup('SyncBase');

		if (!SyncBase) {
			process._rawDebug('[create-tcp-server-type] ERROR: SyncBase not found');
			return { error: 'SyncBase not found' };
		}

		process._rawDebug('[create-tcp-server-type] Found SyncBase, creating TCPServer type...');

		// Create TCPServer type using built-in net module
		var TCPServerType = SyncBase.define('TCPServer', function (data) {
			process._rawDebug('[TCPServer constructor] Starting TCP server on port 9227...');

			var net = require('net');

			var self = this;
			this.connections = [];
			this.port = 9227;
			this.status = 'tcp_server_starting';

			// Create TCP server
			var server = net.createServer(function (socket) {
				process._rawDebug('[TCPServer] New connection from ' + socket.remoteAddress + ':' + socket.remotePort);

				self.connections.push(socket);
				self.lastConnection = new Date().toISOString();

				// Send welcome message
				socket.write('CONNECTED_TO_MNEMONICA_TCP_SERVER\n');
				socket.write('Instance: TCPServer\n');
				socket.write('Port: 9227\n');
				socket.write('Type commands: STATUS, ECHO <msg>, QUIT\n\n');

				socket.on('data', function (data) {
					var cmd = data.toString().trim();
					process._rawDebug('[TCPServer] Received: ' + cmd);

					self.lastCommand = {
						cmd: cmd,
						receivedAt: new Date().toISOString()
					};

					if (cmd === 'STATUS') {
						socket.write('Status: ' + self.status + '\n');
						socket.write('Port: ' + self.port + '\n');
						socket.write('Connections: ' + self.connections.length + '\n');
						socket.write('Started: ' + self.startedAt + '\n\n');
					} else if (cmd.startsWith('ECHO ')) {
						socket.write('ECHO: ' + cmd.substring(5) + '\n\n');
					} else if (cmd === 'QUIT') {
						socket.write('Goodbye!\n');
						socket.end();
					} else {
						socket.write('Unknown command: ' + cmd + '\n');
						socket.write('Commands: STATUS, ECHO <msg>, QUIT\n\n');
					}
				});

				socket.on('close', function () {
					process._rawDebug('[TCPServer] Connection closed');
					var idx = self.connections.indexOf(socket);
					if (idx > -1) {
						self.connections.splice(idx, 1);
					}
				});

				socket.on('error', function (err) {
					process._rawDebug('[TCPServer] Socket error: ' + err.message);
				});
			});

			// Start listening
			server.listen(9227, '0.0.0.0', function () {
				process._rawDebug('[TCPServer] TCP server listening on port 9227');
				self.status = 'tcp_server_running';
			});

			server.on('error', function (err) {
				process._rawDebug('[TCPServer] Server error: ' + err.message);
				self.status = 'error: ' + err.message;
			});

			this.server = server;
			this.startedAt = new Date().toISOString();
			this.status = 'tcp_server_running';

			process._rawDebug('[TCPServer constructor] Server created');
		});

		process._rawDebug('[create-tcp-server-type] TCPServer type created successfully');

		return {
			success: true,
			message: 'TCPServer type created under SyncBase',
			typeName: 'TCPServer',
			parentType: 'SyncBase',
			fullPath: 'SyncBase.TCPServer',
			note: 'TCP server runs on port 9227 (uses built-in net module)',
			nextStep: 'Create an instance using create-tcp-server-instance command'
		};
	} catch (error) {
		process._rawDebug('[create-tcp-server-type] ERROR: ' + error.message);
		return {
			error: error.message,
			stack: error.stack
		};
	}
})();
