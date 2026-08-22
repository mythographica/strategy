/**
 * MCP Tool Metadata:
 * {
 *   "name": "try_open_inspector_9228",
 *   "description": "Attempt to open Node.js inspector on port 9228 (will fail - demo only)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "excludeFromMCP": true
 * }
 */

// This demonstrates that Node.js inspector is a singleton
// Attempting to open a second inspector will fail

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

		process._rawDebug('[try-open-inspector-9228] Attempting to open inspector on port 9228...');

		var SyncBase = mnemonica.defaultTypes.lookup('SyncBase');

		if (!SyncBase) {
			return { error: 'SyncBase not found' };
		}

		// This type will fail when instantiated because inspector is already active on 9229
		var SecondInspector = SyncBase.define('SecondInspector', function (data) {
			process._rawDebug('[SecondInspector] About to try inspector.open(9228)...');

			var inspector = require('inspector');

			// This WILL FAIL if inspector already open on 9229
			inspector.open(9228, '0.0.0.0', true);

			this.port = 9228;
			this.status = 'inspector_opened';

			process._rawDebug('[SecondInspector] SUCCESS - Inspector opened on 9228!');
		});

		return {
			success: true,
			message: 'SecondInspector type created. Now creating instance to demonstrate the error...',
			nextStep: 'Run create-second-inspector-instance to see the failure'
		};
	} catch (error) {
		return {
			error: error.message,
			stack: error.stack
		};
	}
})();
