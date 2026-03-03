/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_http_server_instance",
 *   "description": "Create an instance of HTTPServer that starts HTTP server on port 9228",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "excludeFromMCP": true
 * }
 */

// This script creates an HTTPServer instance which starts HTTP server on port 9228

(() => {
	try {
		var mnemonica = process.mainModule.require('mnemonica');

		process._rawDebug('[create-http-server-instance] Starting...');

		// Get SyncBase using lookup
		var SyncBase = mnemonica.defaultTypes.lookup('SyncBase');

		if (!SyncBase) {
			process._rawDebug('[create-http-server-instance] ERROR: SyncBase not found');
			return {
				error: 'SyncBase not found'
			};
		}

		process._rawDebug('[create-http-server-instance] Found SyncBase');

		// Get HTTPServer using lookup on SyncBase
		var HTTPServer = SyncBase.lookup('HTTPServer');

		if (!HTTPServer) {
			process._rawDebug('[create-http-server-instance] ERROR: HTTPServer not found. Run create-http-server-type first.');
			return {
				error: 'HTTPServer not found. Run create-http-server-type first.'
			};
		}

		process._rawDebug('[create-http-server-instance] Found HTTPServer, creating instance...');

		// First create a SyncBase instance as parent
		var syncInstance = new SyncBase({
			baseValue: 'Parent instance for HTTPServer',
			purpose: 'HTTP server demo'
		});

		process._rawDebug('[create-http-server-instance] Created SyncBase parent instance');

		// Create HTTPServer instance from parent
		var httpInstance = syncInstance.HTTPServer({
			createdBy: 'AI Strategy',
			port: 9228,
			note: 'HTTP server for Chrome DevTools discovery'
		});

		process._rawDebug('[create-http-server-instance] HTTPServer instance created!');

		// Store in global registry
		if (!global.mnemonicaInstances) {
			global.mnemonicaInstances = new Map();
		}

		global.mnemonicaInstances.set('http-server-001', {
			id: 'http-server-001',
			instance: httpInstance,
			type: 'HTTPServer',
			parentId: 'sync-parent',
			createdAt: new Date().toISOString()
		});

		process._rawDebug('[create-http-server-instance] Instance stored in registry');

		return {
			success: true,
			message: 'HTTPServer instance created - HTTP server running on port 9228!',
			instanceId: 'http-server-001',
			port: 9228,
			status: httpInstance.status,
			properties: {
				port: httpInstance.port,
				status: httpInstance.status,
				startedAt: httpInstance.startedAt
			},
			urls: {
				root: 'http://localhost:9228',
				jsonList: 'http://localhost:9228/json/list'
			},
			chromeDevTools: {
				note: 'Check chrome://inspect - the server should appear as a target'
			}
		};
	} catch (error) {
		process._rawDebug('[create-http-server-instance] ERROR: ' + error.message);
		return {
			error: error.message,
			stack: error.stack
		};
	}
})();
