/**
 * MCP Tool Metadata:
 * {
 *   "name": "switch_inspector_port",
 *   "description": "Close inspector on 9229 and reopen on 9227",
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

		process._rawDebug('[switch-inspector-port] Attempting to switch inspector port...');
		process._rawDebug('[switch-inspector-port] Current port: 9229, target port: 9227');

		var inspector = process.mainModule.require('inspector');

		// Check if inspector is active
		var url = inspector.url();
		process._rawDebug('[switch-inspector-port] Current inspector URL: ' + url);

		// Close existing inspector
		process._rawDebug('[switch-inspector-port] Closing inspector on 9229...');
		inspector.close();
		process._rawDebug('[switch-inspector-port] Inspector closed');

		// Now try to open on 9227
		process._rawDebug('[switch-inspector-port] Opening inspector on 9227...');
		inspector.open(9227, '0.0.0.0', true);

		var newUrl = inspector.url();
		process._rawDebug('[switch-inspector-port] New inspector URL: ' + newUrl);

		return {
			success: true,
			message: 'Inspector switched from 9229 to 9227!',
			oldPort: 9229,
			newPort: 9227,
			newUrl: newUrl
		};
	} catch (error) {
		process._rawDebug('[switch-inspector-port] ERROR: ' + error.message);
		return {
			success: false,
			error: error.message,
			stack: error.stack
		};
	}
})();
