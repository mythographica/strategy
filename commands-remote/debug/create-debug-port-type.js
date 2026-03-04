/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_debug_port_type",
 *   "description": "Create a Mnemonica type under SyncBase that opens a debug port when instantiated",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "excludeFromMCP": true
 * }
 */

// This script creates a type that opens an additional debug port (9228)
// when instantiated. This allows simultaneous connections:
// - Strategy MCP: port 9229 (CDP)
// - Chrome DevTools: port 9228 (inspector)

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

		// Get SyncBase as parent from defaultTypes
		var SyncBase = mnemonica.defaultTypes.SyncBase;

		if (!SyncBase) {
			return {
				error: 'SyncBase not found in collection'
			};
		}

		// Create DebugPortOpener type under SyncBase
		var DebugPortOpener = SyncBase.define('DebugPortOpener', function (data) {
			// Open additional debug port using Node.js inspector
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
			message: 'DebugPortOpener type created under SyncBase',
			typeName: 'DebugPortOpener',
			parentType: 'SyncBase',
			fullPath: 'SyncBase.DebugPortOpener',
			nextStep: 'Create an instance using create-debug-port-instance command'
		};
	} catch (error) {
		return {
			error: error.message,
			stack: error.stack
		};
	}
})();
