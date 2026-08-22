/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_tcp_server_instance",
 *   "description": "Create a TCP server instance on port 9227",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "excludeFromMCP": true
 * }
 */

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

		process._rawDebug('[create-tcp-server-instance] Starting...');

		// Get SyncBase using lookup
		var SyncBase = mnemonica.defaultTypes.lookup('SyncBase');

		if (!SyncBase) {
			process._rawDebug('[create-tcp-server-instance] ERROR: SyncBase not found');
			return { error: 'SyncBase not found' };
		}

		// Get TCPServer using lookup
		var TCPServer = SyncBase.lookup('TCPServer');

		if (!TCPServer) {
			process._rawDebug('[create-tcp-server-instance] ERROR: TCPServer not found. Run create-tcp-server-type first.');
			return { error: 'TCPServer not found. Run create-tcp-server-type first.' };
		}

		process._rawDebug('[create-tcp-server-instance] Found TCPServer, creating instance...');

		// Create parent instance
		var syncInstance = new SyncBase({
			baseValue: 'Parent for TCPServer',
			purpose: 'TCP server demo'
		});

		// Create TCPServer instance
		var tcpInstance = syncInstance.TCPServer({
			createdBy: 'AI Strategy',
			port: 9227
		});

		process._rawDebug('[create-tcp-server-instance] TCPServer instance created on port 9227!');

		// Store in registry
		if (!global.mnemonicaInstances) {
			global.mnemonicaInstances = new Map();
		}

		global.mnemonicaInstances.set('tcp-server-001', {
			id: 'tcp-server-001',
			instance: tcpInstance,
			type: 'TCPServer',
			createdAt: new Date().toISOString()
		});

		return {
			success: true,
			message: 'TCPServer instance created on port 9227!',
			port: 9227,
			status: tcpInstance.status,
			connections: tcpInstance.connections.length,
			note: 'Connect with: telnet localhost 9227 or nc localhost 9227'
		};
	} catch (error) {
		process._rawDebug('[create-tcp-server-instance] ERROR: ' + error.message);
		return { error: error.message, stack: error.stack };
	}
})();
