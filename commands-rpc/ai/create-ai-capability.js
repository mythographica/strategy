/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_ai_capability",
 *   "description": "Create a new AI capability as a Mnemonica type in isolated collection",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "name": {
 *         "type": "string",
 *         "description": "Name of the capability"
 *       },
 *       "description": {
 *         "type": "string",
 *         "description": "What this capability does"
 *       }
 *     },
 *     "required": ["name"]
 *   }
 * }
 */

// Create AI capability in isolated collection
// Does NOT use defaultTypes - creates separate type hierarchy

var { require, args } = ctx;

if (args.message && typeof args.message === 'string') {
	try {
		args = JSON.parse(args.message);
	} catch (e) {}
}

try {
	var mnemonica = require('mnemonica');

	// Create isolated collection for AI capabilities
	if (!global.aiTypesCollection) {
		global.aiTypesCollection = mnemonica.createTypesCollection({
			strictChain: false
		});
	}

	var collection = global.aiTypesCollection;

	// Get or create AI root in isolated collection
	var AI = collection.AI;
	if (!AI) {
		AI = collection.define('AI', function (data) {
			this.identity = data.identity || 'AI Agent';
			this.createdAt = Date.now();
		});
	}

	var name = args.name;
	var description = args.description || 'AI capability';

	// Check if exists
	if (AI[name]) {
		return {
			success: false,
			error: 'Capability ' + name + ' already exists',
			existing: true
		};
	}

	// Create capability as subtype
	var Capability = AI.define(name, function (data) {
		this.description = description;
		this.createdAt = Date.now();
		this.active = true;
	});

	// Create instance
	var instance = new Capability({});

	// Store in isolated registry (not defaultTypes!)
	if (!global.aiCapabilityRegistry) {
		global.aiCapabilityRegistry = new Map();
	}
	global.aiCapabilityRegistry.set(name, {
		name: name,
		type: Capability,
		instance: instance,
		collection: 'aiTypesCollection', // isolated!
		createdAt: new Date().toISOString()
	});

	return {
		success: true,
		message: 'AI capability created in isolated collection',
		capability: {
			name: name,
			description: description,
			parent: 'AI',
			collection: 'aiTypesCollection'
		},
		isolated: true,
		philosophy: 'Isolated collections prevent pollution of defaultTypes'
	};

} catch (e) {
	return {
		success: false,
		error: e.message
	};
}
