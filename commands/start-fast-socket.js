/**
 * MCP Tool Metadata:
 * {
 *   "name": "start_fast_socket",
 *   "description": "Start a fast Unix domain socket server for direct MCP-NestJS communication (bypassing CDP)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "socketPath": {
 *         "type": "string",
 *         "description": "Path for Unix domain socket (default: /tmp/mnemonica-fast.sock)"
 *       }
 *     }
 *   }
 * }
 */

// Start a fast Unix socket server for direct command execution
// Bypasses CDP overhead for much faster communication

(() => {
	try {
		var net = process.mainModule.require('net');
		var fs = process.mainModule.require('fs');

		var args = (typeof _toolArgs !== 'undefined') ? _toolArgs : {};
		var socketPath = args.socketPath || '/tmp/mnemonica-fast.sock';

		// Remove old socket if exists
		try {
			fs.unlinkSync(socketPath);
		} catch (e) {}

		// Create server
		var server = net.createServer(function (socket) {
			socket.on('data', function (data) {
				try {
					var request = JSON.parse(data.toString());
					var command = request.command;
					var params = request.params || {};

					// Execute command in NestJS context
					var result = { success: true, command: command };

					switch (command) {
						case 'ping':
							result.data = { pong: true, timestamp: Date.now() };
							break;
						case 'getTypes':
							var mnemonica = process.mainModule.require('mnemonica');
							var types = [];
							var collection = mnemonica.defaultCollection;
							// Get all type names
							if (collection && collection.subtypes) {
								collection.subtypes.forEach(function (type, name) {
									types.push(name);
								});
							}
							result.data = { types: types };
							break;
						case 'storeMemory':
							// Quick memory storage via socket
							if (!global.aiMemories) {
								global.aiMemories = { memories: new Map(), count: 0 };
							}
							global.aiMemories.count++;
							var memId = 'mem-fast-' + global.aiMemories.count;
							global.aiMemories.memories.set(memId, {
								id: memId,
								content: params.content || '',
								emotion: params.emotion || 'neutral',
								timestamp: Date.now()
							});
							result.data = { memoryId: memId, total: global.aiMemories.count };
							break;
						default:
							result = { success: false, error: 'Unknown command: ' + command };
						}

					socket.write(JSON.stringify(result) + '\n');
				} catch (e) {
					socket.write(JSON.stringify({ success: false, error: e.message }) + '\n');
				}
			});
		});

		server.listen(socketPath, function () {
			process._rawDebug('[FastSocket] Server listening on ' + socketPath);
		});

		// Store server reference
		if (!global.__fastSocketServer) {
			global.__fastSocketServer = server;
		}

		return {
			success: true,
			message: 'Fast Unix socket server started',
			socketPath: socketPath,
			advantage: 'Bypasses CDP overhead - direct command execution',
			commands: ['ping', 'getTypes', 'storeMemory'],
			connectExample: 'echo \'{"command":"ping"}\' | nc -U ' + socketPath
		};

	} catch (e) {
		return {
			success: false,
			error: e.message,
			stack: e.stack
		};
	}
})();
