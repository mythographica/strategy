/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_debug_port_type_fixed",
 *   "description": "Create a fixed Mnemonica type that opens debug port using process.mainModule.require",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "excludeFromMCP": true
 * }
 */

// This script creates a type that opens an additional debug port (9228)
// Uses process.mainModule.require for CDP compatibility

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

		// Get SyncBase as parent
		var SyncBase = mnemonica.defaultTypes.SyncBase;

		if (!SyncBase) {
			return {
				error: 'SyncBase not found'
			};
		}

		// Create DebugPortOpenerFixed type with fixed require
		var DebugPortOpenerFixed = SyncBase.define('DebugPortOpenerFixed', function (data) {
			// Use require for CDP context (now from ctx)
			var inspector = require('inspector');

			// Open port 9228 for Chrome DevTools connection
			inspector.open(9228, '0.0.0.0', true);

			this.port = 9228;
			this.host = '0.0.0.0';
			this.status = 'debug_port_open';
			this.openedAt = new Date().toISOString();
			this.originalArgs = data;
		});

		return {
			success: true,
			message: 'DebugPortOpenerFixed type created under SyncBase',
			typeName: 'DebugPortOpenerFixed',
			parentType: 'SyncBase',
			fullPath: 'SyncBase.DebugPortOpenerFixed',
			nextStep: 'Create an instance using create-debug-port-instance-fixed command'
		};
	} catch (error) {
		return {
			error: error.message,
			stack: error.stack
		};
	}
})();
