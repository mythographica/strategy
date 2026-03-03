/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_debug_port_instance",
 *   "description": "Create an instance of DebugPortOpener that opens port 9228 for Chrome DevTools",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

// This script creates a DebugPortOpener instance which opens port 9228
// After running this, you can connect Chrome DevTools to localhost:9228

(() => {
	try {
		var mnemonica = process.mainModule.require('mnemonica');

		// Get SyncBase and DebugPortOpener from defaultTypes
		var SyncBase = mnemonica.defaultTypes.SyncBase;

		if (!SyncBase) {
			return {
				error: 'SyncBase not found'
			};
		}

		var DebugPortOpener = SyncBase.DebugPortOpener;

		if (!DebugPortOpener) {
			return {
				error: 'DebugPortOpener not found. Run create-debug-port-type first.'
			};
		}

		// First create a SyncBase instance as parent
		var syncInstance = new SyncBase({
			baseValue: 'Parent instance for DebugPortOpener',
			purpose: 'Dual debug port demo'
		});

		// Create DebugPortOpener instance from parent
		// This will open port 9228 when instantiated!
		var debugInstance = syncInstance.DebugPortOpener({
			createdBy: 'AI Strategy',
			port: 9228,
			note: 'Connect Chrome DevTools to this port'
		});

		// Store in global registry
		if (!global.mnemonicaInstances) {
			global.mnemonicaInstances = new Map();
		}

		global.mnemonicaInstances.set('debug-port-001', {
			id: 'debug-port-001',
			instance: debugInstance,
			type: 'DebugPortOpener',
			parentId: 'sync-parent',
			createdAt: new Date().toISOString()
		});

		return {
			success: true,
			message: 'DebugPortOpener instance created - debug port 9228 is now OPEN',
			instanceId: 'debug-port-001',
			port: 9228,
			status: 'debug_port_open',
			properties: {
				port: debugInstance.port,
				host: debugInstance.host,
				status: debugInstance.status,
				openedAt: debugInstance.openedAt
			},
			chromeDevTools: {
				url: 'chrome://inspect',
				orDirect: 'ws://localhost:9228',
				note: 'Open Chrome and navigate to chrome://inspect, or connect directly to ws://localhost:9228'
			},
			connections: {
				strategyMCP: 'Connected to port 9229 (current)',
				chromeDevTools: 'Available on port 9228 (new)'
			}
		};
	} catch (error) {
		return {
			error: error.message,
			stack: error.stack
		};
	}
})();
