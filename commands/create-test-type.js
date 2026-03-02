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
 *   }
 * }
 */

// This script creates a new Mnemonica type in the running application

(() => {
	try {
		// Get the type name from arguments
		var typeName = (typeof _toolArgs !== 'undefined' && _toolArgs.typeName) ? _toolArgs.typeName : 'TestType';
		
		// Load mnemonica
		var mnemonica = process.mainModule.require('mnemonica');
		var define = mnemonica.define;
		
		// Create the new type
		var NewType = define(typeName, function (data) {
			this.message = data.message;
			this.createdAt = Date.now();
		});
		
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
})()
