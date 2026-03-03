/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_ws_server_instance",
 *   "description": "Create a WebSocket server instance on port 9227",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

(() => {
	try {
		var mnemonica = process.mainModule.require('mnemonica');

		process._rawDebug('[create-ws-server-instance] Starting...');

		// Get SyncBase using lookup
		var SyncBase = mnemonica.defaultTypes.lookup('SyncBase');

		if (!SyncBase) {
			process._rawDebug('[create-ws-server-instance] ERROR: SyncBase not found');
			return { error: 'SyncBase not found' };
		}

		// Get WebSocketServer using lookup
		var WebSocketServer = SyncBase.lookup('WebSocketServer');

		if (!WebSocketServer) {
			process._rawDebug('[create-ws-server-instance] ERROR: WebSocketServer not found. Run create-websocket-server-type first.');
			return { error: 'WebSocketServer not found. Run create-websocket-server-type first.' };
		}

		process._rawDebug('[create-ws-server-instance] Found WebSocketServer, creating instance...');

		// Create parent instance
		var syncInstance = new SyncBase({
			baseValue: 'Parent for WebSocketServer',
			purpose: 'WebSocket server demo'
		});

		// Create WebSocketServer instance
		var wsInstance = syncInstance.WebSocketServer({
			createdBy: 'AI Strategy',
			port: 9227
		});

		process._rawDebug('[create-ws-server-instance] WebSocketServer instance created on port 9227!');

		// Store in registry
		if (!global.mnemonicaInstances) {
			global.mnemonicaInstances = new Map();
		}

		global.mnemonicaInstances.set('ws-server-001', {
			id: 'ws-server-001',
			instance: wsInstance,
			type: 'WebSocketServer',
			createdAt: new Date().toISOString()
		});

		return {
			success: true,
			message: 'WebSocketServer instance created on port 9227!',
			port: 9227,
			status: wsInstance.status,
			connections: wsInstance.connections.length
		};
	} catch (error) {
		process._rawDebug('[create-ws-server-instance] ERROR: ' + error.message);
		return { error: error.message, stack: error.stack };
	}
})();
