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

// Create a new Mnemonica type in the running application via CDP

var { require, args } = ctx;

if (args.message && typeof args.message === 'string') {
	try {
		args = JSON.parse(args.message);
	} catch (e) {}
}

try {
	console.log('');
	console.log('=== NESTJS EXECUTION: create-test-type ===');
	console.log('Creating type in NestJS runtime via CDP');
	console.log('Timestamp: ' + new Date().toISOString());
	console.log('Process PID: ' + process.pid);
	console.log('======================================');

	var typeName = args.typeName || 'TestType';
	var mnemonica = require('mnemonica');

	// Define constructor function
	function TestTypeConstructor (data) {
		this.message = (data && data.message) ? data.message : 'default message';
		this.createdAt = Date.now();
	}

	// Create the type
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
