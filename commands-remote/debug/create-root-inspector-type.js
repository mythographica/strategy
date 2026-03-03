/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_root_inspector_type",
 *   "description": "Create a root type that opens inspector on port 9227",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "excludeFromMCP": true
 * }
 */

(() => {
	try {
		var mnemonica = process.mainModule.require('mnemonica');

		process._rawDebug('[create-root-inspector-type] Creating root type SecondInspector...');

		// Create SecondInspector as a ROOT type (not under SyncBase)
		var SecondInspector = mnemonica.defaultTypes.define('SecondInspector', function (data) {
			process._rawDebug('[SecondInspector] Constructor called, opening inspector on 9227...');

			// Use inspector directly (available in Node.js namespace)
			inspector.open(9227, '0.0.0.0', true);

			this.port = 9227;
			this.status = 'inspector_opened';
			this.openedAt = new Date().toISOString();

			process._rawDebug('[SecondInspector] SUCCESS - Inspector opened on port 9227!');
		});

		process._rawDebug('[create-root-inspector-type] SecondInspector root type created');

		return {
			success: true,
			message: 'SecondInspector root type created',
			typeName: 'SecondInspector',
			isRootType: true,
			fullPath: 'defaultTypes.SecondInspector',
			nextStep: 'Create instance using create-root-inspector-instance'
		};
	} catch (error) {
		process._rawDebug('[create-root-inspector-type] ERROR: ' + error.message);
		return {
			error: error.message,
			stack: error.stack
		};
	}
})();
