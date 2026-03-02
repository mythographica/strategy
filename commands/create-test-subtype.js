/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_test_subtype",
 *   "description": "Create subtypes under TestType in the running application",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

// This script creates subtypes under TestType

(() => {
	try {
		// Load mnemonica
		var mnemonica = process.mainModule.require('mnemonica');
		var defaultTypes = mnemonica.defaultTypes;
		
		// Get TestType from defaultTypes
		var TestType = defaultTypes.TestType;
		
		if (!TestType) {
			return { error: 'TestType not found. Create it first using create-test-type.' };
		}
		
		// Create subtypes
		var TestChildA = TestType.define('TestChildA', function (data) {
			this.value = data.value || 'A';
		});
		
		var TestChildB = TestType.define('TestChildB', function (data) {
			this.value = data.value || 'B';
		});
		
		// Create grandchild
		var TestGrandChild = TestChildA.define('TestGrandChild', function (data) {
			this.nested = data.nested || true;
		});
		
		return {
			success: true,
			message: 'Created subtypes: TestChildA, TestChildB, TestGrandChild (under TestChildA)',
			parentType: 'TestType',
			createdTypes: ['TestChildA', 'TestChildB', 'TestGrandChild'],
			TestType_has_subtypes: !!TestType.subtypes,
			TestChildA_has_subtypes: !!TestChildA.subtypes
		};
	} catch (e) {
		return { 
			success: false, 
			error: e.message, 
			stack: e.stack 
		};
	}
})()
