/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_test_instances",
 *   "description": "Create instances of TestType and its subtypes with proper inheritance chain, storing them in global scope for runtime communication",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "excludeFromMCP": true
 * }
 */

// This script creates instances with proper Mnemonica inheritance chain
// Child instances must be created from parent instances

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
		var collection = mnemonica.defaultCollection;

		// Get the constructors from the collection
		// Mnemonica collections support direct property access via Proxy
		var TestType = collection.TestType;
		// Or use lookup for nested paths: collection.lookup('TestType')

		if (!TestType) {
			return {
				error: 'TestType not found in defaultCollection. Run create-test-type first.'
			};
		}

		// Get subtypes from TestType
		// Each type is also a collection with the same Proxy API
		var TestChildA = TestType.TestChildA;
		var TestChildB = TestType.TestChildB;

		if (!TestChildA || !TestChildB) {
			return {
				error: 'TestChildA or TestChildB not found. Run create-test-subtype first.'
			};
		}

		// Get grandchild from TestChildA
		// Can use direct property access on subtypes collection
		var TestGrandChild = TestChildA.TestGrandChild;

		if (!TestGrandChild) {
			return {
				error: 'TestGrandChild not found. Run create-test-subtype first.'
			};
		}

		// Create instances with PROPER INHERITANCE CHAIN
		// First create root instance
		var testInstance = new TestType({
			message: 'Hello from TestType instance!',
			createdBy: 'AI Agent',
			purpose: 'Runtime communication demo'
		});

		// Create child instances FROM the parent instance
		// This is Mnemonica's instance inheritance pattern!
		var childAInstance = testInstance.TestChildA({
			message: 'Child A reporting',
			value: 'A1',
			tag: 'first child'
		});

		var childBInstance = testInstance.TestChildB({
			message: 'Child B online',
			value: 'B1',
			tag: 'second child'
		});

		// Create grandchild FROM childA instance
		var grandChildInstance = childAInstance.TestGrandChild({
			message: 'Grandchild here!',
			value: 'G1',
			nested: true,
			level: 'deep'
		});

		// Store instances in global registry for AI communication
		if (!global.mnemonicaInstances) {
			global.mnemonicaInstances = new Map();
		}

		// Store with metadata including parent references
		var instances = [
			{
				id: 'test-001',
				instance: testInstance,
				type: 'TestType',
				parentId: null,
				createdAt: new Date().toISOString()
			},
			{
				id: 'child-a-001',
				instance: childAInstance,
				type: 'TestChildA',
				parentId: 'test-001',
				createdAt: new Date().toISOString()
			},
			{
				id: 'child-b-001',
				instance: childBInstance,
				type: 'TestChildB',
				parentId: 'test-001',
				createdAt: new Date().toISOString()
			},
			{
				id: 'grandchild-001',
				instance: grandChildInstance,
				type: 'TestGrandChild',
				parentId: 'child-a-001',
				createdAt: new Date().toISOString()
			}
		];

		// Store in global registry
		instances.forEach(function (item) {
			global.mnemonicaInstances.set(item.id, item);
		});

		// Helper to extract instance info
		function getInstanceInfo (item) {
			var inst = item.instance;
			var props = {};

			// Get own properties
			Object.keys(inst).forEach(function (key) {
				try {
					var val = inst[key];
					if (typeof val !== 'function') {
						props[key] = val;
					}
				} catch (e) {}
			});

			// Check inheritance using instanceof
			var inheritanceChain = [];
			try {
				if (inst instanceof TestType) inheritanceChain.push('TestType');
				if (inst instanceof TestChildA) inheritanceChain.push('TestChildA');
				if (inst instanceof TestChildB) inheritanceChain.push('TestChildB');
				if (inst instanceof TestGrandChild) inheritanceChain.push('TestGrandChild');
			} catch (e) {}

			return {
				id: item.id,
				type: item.type,
				parentId: item.parentId,
				createdAt: item.createdAt,
				properties: props,
				inheritanceChain: inheritanceChain
			};
		}

		return {
			success: true,
			message: 'Instances created with proper inheritance chain',
			instanceCount: instances.length,
			instances: instances.map(getInstanceInfo),
			explanation: {
				pattern: 'Mnemonica Instance Inheritance',
				details: 'Child instances created from parent instances using parent.ChildType(data)',
				example: 'parent.TestChildA({ value: "A" }) creates child that inherits from parent'
			},
			registryAccess: {
				globalVar: 'global.mnemonicaInstances',
				type: 'Map<string, InstanceRecord>',
				description: 'Access instances via global.mnemonicaInstances.get(id)'
			}
		};
	} catch (error) {
		return {
			error: error.message,
			stack: error.stack
		};
	}
})();
