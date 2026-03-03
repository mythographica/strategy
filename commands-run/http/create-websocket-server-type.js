/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_websocket_server_type",
 *   "description": "Create a Mnemonica type that starts a WebSocket server for dual communication",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "excludeFromMCP": true
 * }
 */

// This script creates a type that starts a WebSocket server
// Allows simultaneous communication:
// - Strategy MCP: port 9229 (CDP)
// - WebSocket Client (Chrome DevTools extension): port 9227

(() => {
	try {
		var mnemonica = process.mainModule.require('mnemonica');

		process._rawDebug('[create-websocket-server-type] Starting...');

		// Get SyncBase as parent using lookup
		var SyncBase = mnemonica.defaultTypes.lookup('SyncBase');

		if (!SyncBase) {
			process._rawDebug('[create-websocket-server-type] ERROR: SyncBase not found');
			return {
				error: 'SyncBase not found'
			};
		}

		process._rawDebug('[create-websocket-server-type] Found SyncBase');

		// Create WebSocketServer type
		var WebSocketServerType = SyncBase.define('WebSocketServer', function (data) {
			var WebSocket = process.mainModule.require('ws');

			// Create WebSocket server on port 9227
			var wss = new WebSocket.Server({ port: 9227 });

			this.port = 9227;
			this.status = 'websocket_server_running';
			this.startedAt = new Date().toISOString();
			this.connections = [];

			var self = this;

			wss.on('connection', function (ws) {
				self.connections.push(ws);
				self.lastConnection = new Date().toISOString();

				ws.send(JSON.stringify({
					type: 'connected',
					message: 'Connected to Mnemonica instance via WebSocket',
					instanceType: 'WebSocketServer',
					port: 9227
				}));

				ws.on('message', function (message) {
					try {
						var data = JSON.parse(message);
						self.lastMessage = {
							data: data,
							receivedAt: new Date().toISOString()
						};

						// Echo back with instance state
						ws.send(JSON.stringify({
							type: 'response',
							received: data,
							instanceState: {
								port: self.port,
								status: self.status,
								startedAt: self.startedAt,
								connectionCount: self.connections.length
							}
						}));
					} catch (e) {
						ws.send(JSON.stringify({
							type: 'error',
							error: e.message
						}));
					}
				});
			});

			this.wss = wss;

			process._rawDebug('[WebSocketServer constructor] Server created on port 9227');
		});

		process._rawDebug('[create-websocket-server-type] WebSocketServer type created successfully');

		return {
			success: true,
			message: 'WebSocketServer type created under SyncBase',
			typeName: 'WebSocketServer',
			parentType: 'SyncBase',
			fullPath: 'SyncBase.WebSocketServer',
			note: 'WebSocket server runs on port 9227',
			nextStep: 'Create an instance using create-ws-server-instance command'
		};
	} catch (error) {
		return {
			error: error.message,
			stack: error.stack
		};
	}
})();
