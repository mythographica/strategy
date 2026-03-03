/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_second_inspector_instance",
 *   "description": "Create instance that tries to open second inspector (demonstrates singleton limitation)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

(() => {
	try {
		var mnemonica = process.mainModule.require('mnemonica');

		process._rawDebug('[create-second-inspector-instance] Starting...');

		var SyncBase = mnemonica.defaultTypes.lookup('SyncBase');

		if (!SyncBase) {
			return { error: 'SyncBase not found' };
		}

		var SecondInspector = SyncBase.lookup('SecondInspector');

		if (!SecondInspector) {
			process._rawDebug('[create-second-inspector-instance] SecondInspector type not found, creating it first...');
			// Create the type dynamically
			SecondInspector = SyncBase.define('SecondInspector', function (data) {
				process._rawDebug('[SecondInspector] Trying inspector.open(9228)...');
				var inspector = process.mainModule.require('inspector');
				inspector.open(9228, '0.0.0.0', true);
				this.port = 9228;
			});
		}

		process._rawDebug('[create-second-inspector-instance] Creating instance (this will fail)...');

		var syncInstance = new SyncBase({
			baseValue: 'Parent for SecondInspector',
			purpose: 'Demonstrate inspector singleton'
		});

		// This will FAIL - demonstrating the singleton limitation
		var inspectorInstance = syncInstance.SecondInspector({});

		return {
			success: true,
			message: 'SecondInspector created - THIS SHOULD NOT HAPPEN!'
		};
	} catch (error) {
		process._rawDebug('[create-second-inspector-instance] EXPECTED ERROR: ' + error.message);
		return {
			success: false,
			expectedError: true,
			message: 'Node.js inspector is a singleton - only one debug port per process',
			error: error.message,
			demonstration: 'This proves we cannot have multiple inspectors in one Node.js process'
		};
	}
})();
