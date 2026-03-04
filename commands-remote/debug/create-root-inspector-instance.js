/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_root_inspector_instance",
 *   "description": "Create instance of SecondInspector root type that opens inspector on 9227",
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

		process._rawDebug('[create-root-inspector-instance] Starting...');

		// Get SecondInspector using lookup from defaultTypes
		var SecondInspector = mnemonica.defaultTypes.lookup('SecondInspector');

		if (!SecondInspector) {
			process._rawDebug('[create-root-inspector-instance] SecondInspector not found, creating type first...');

			// Create the root type
			SecondInspector = mnemonica.defaultTypes.define('SecondInspector', function (data) {
				process._rawDebug('[SecondInspector] Opening inspector on port 9227...');

				// Use inspector module directly
				var inspector = require('inspector');
				inspector.open(9227, '0.0.0.0', true);

				this.port = 9227;
				this.status = 'inspector_opened';
				this.openedAt = new Date().toISOString();

				process._rawDebug('[SecondInspector] Inspector opened on 9227!');
			});
		}

		process._rawDebug('[create-root-inspector-instance] Creating SecondInspector instance...');

		// Create instance - this should open inspector on 9227
		var inspectorInstance = new SecondInspector({
			createdBy: 'AI Strategy',
			purpose: 'Second inspector demo'
		});

		process._rawDebug('[create-root-inspector-instance] Instance created!');

		return {
			success: true,
			message: 'SecondInspector instance created - inspector should be on port 9227!',
			port: inspectorInstance.port,
			status: inspectorInstance.status,
			openedAt: inspectorInstance.openedAt,
			note: 'Check if port 9227 is now listening for inspector connections'
		};
	} catch (error) {
		process._rawDebug('[create-root-inspector-instance] ERROR: ' + error.message);
		return {
			success: false,
			error: error.message,
			stack: error.stack
		};
	}
})();
