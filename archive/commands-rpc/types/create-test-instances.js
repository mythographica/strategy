/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_test_instances",
 *   "description": "Create test instances of Mnemonica types",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

// Create test instances of Mnemonica types via CDP

var { require, args } = ctx;

if (args.message && typeof args.message === 'string') {
	try {
		args = JSON.parse(args.message);
	} catch (e) {}
}

try {
	var mnemonica = require('mnemonica');
	var defaultTypes = mnemonica.defaultTypes;

	// Create test type if not exists
	var TestType = defaultTypes.TestType;
	if (!TestType) {
		TestType = defaultTypes.define('TestType', function (data) {
			this.value = data && data.value ? data.value : 'test';
			this.timestamp = Date.now();
		});
	}

	// Create subtype if not exists
	var TestChild = TestType.TestChild;
	if (!TestChild) {
		TestChild = TestType.define('TestChild', function (data) {
			this.childValue = data && data.childValue ? data.childValue : 'child';
		});
	}

	// Create instances
	var testInstance = new TestType({ value: 'parent-instance' });
	var childInstance = testInstance.TestChild({ childValue: 'child-instance' });

	// Store in global for retrieval
	if (!global.testInstances) {
		global.testInstances = [];
	}
	global.testInstances.push({
		parent: testInstance,
		child: childInstance,
		createdAt: new Date().toISOString()
	});

	return {
		success: true,
		message: 'Test instances created',
		instances: {
			parent: {
				type: 'TestType',
				value: testInstance.value,
				timestamp: testInstance.timestamp
			},
			child: {
				type: 'TestChild',
				childValue: childInstance.childValue,
				parentValue: childInstance.parent.value
			}
		},
		totalStored: global.testInstances.length
	};
} catch (e) {
	return {
		success: false,
		error: e.message,
		stack: e.stack
	};
}
