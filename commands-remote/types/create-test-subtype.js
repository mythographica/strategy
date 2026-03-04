/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_test_subtype",
 *   "description": "Create a subtype of an existing Mnemonica type",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "parentType": {
 *         "type": "string",
 *         "description": "Name of the parent type"
 *       },
 *       "subTypeName": {
 *         "type": "string",
 *         "description": "Name of the new subtype"
 *       }
 *     },
 *     "required": ["parentType", "subTypeName"]
 *   }
 * }
 */

// Create a subtype of an existing Mnemonica type via CDP

var { require, args } = ctx;

if (args.message && typeof args.message === 'string') {
	try {
		args = JSON.parse(args.message);
	} catch (e) {}
}

try {
	var parentTypeName = args.parentType;
	var subTypeName = args.subTypeName;
	var mnemonica = require('mnemonica');

	// Find parent type
	var ParentType = mnemonica.defaultTypes[parentTypeName];
	if (!ParentType) {
		return {
			success: false,
			error: 'Parent type "' + parentTypeName + '" not found'
		};
	}

	// Define constructor for subtype
	function SubTypeConstructor (data) {
		this.subTypeData = data || {};
		this.createdAt = Date.now();
	}

	// Create the subtype
	var SubType = ParentType.define(subTypeName, SubTypeConstructor);

	return {
		success: true,
		parentType: parentTypeName,
		subTypeName: subTypeName,
		message: 'Subtype "' + subTypeName + '" created under "' + parentTypeName + '"',
		isConstructor: typeof SubType === 'function'
	};
} catch (e) {
	return {
		success: false,
		error: e.message,
		stack: e.stack
	};
}
