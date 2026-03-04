/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_test_type",
 *   "description": "Create a new Mnemonica root type in the running application for testing",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "typeName": {
 *         "type": "string",
 *         "description": "Name of the new type to create"
 *       }
 *     },
 *     "required": ["typeName"]
 *   },
 *   "excludeFromMCP": true
 * }
 */

// This script creates a new Mnemonica type in the running application

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
		// Get the type name from arguments
		var typeName = args.typeName || 'TestType';

		// Load mnemonica
		var mnemonica = require('mnemonica');

		// Define constructor function using a named function for proper binding
		function TestTypeConstructor (data) {
			this.message = (data && data.message) ? data.message : 'default message';
			this.createdAt = Date.now();
		}

		// Use defaultTypes.define with the named function
		var NewType = mnemonica.defaultTypes.define(typeName, TestTypeConstructor);

		return {
			success: true,
			typeName: typeName,
			message: 'Type "' + typeName + '" created successfully',
			hasSubTypes: !!NewType.subtypes,
			isConstructor: typeof NewType === 'function'
		};
	} catch (e) {
		return {
			success: false,
			error: e.message,
			stack: e.stack
		};
	}
})();
