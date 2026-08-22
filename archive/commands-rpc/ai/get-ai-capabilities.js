/**
 * MCP Tool Metadata:
 * {
 *   "name": "get_ai_capabilities",
 *   "description": "List AI capabilities from isolated registry",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

// Introspect AI capabilities from isolated registry
// Does NOT depend on defaultTypes or external memory systems

var { args } = ctx;

if (args.message && typeof args.message === 'string') {
	try {
		args = JSON.parse(args.message);
	} catch (e) {}
}

try {
	// Access isolated registry only
	var registry = global.aiCapabilityRegistry;

	if (!registry || registry.size === 0) {
		return {
			status: 'empty',
			message: 'No AI capabilities created yet',
			capabilities: [],
			count: 0,
			hint: 'Use create_ai_capability to add capabilities'
		};
	}

	// Collect from isolated registry
	var capabilities = [];
	registry.forEach(function (item, name) {
		capabilities.push({
			name: name,
			description: item.instance.description,
			createdAt: item.createdAt,
			active: item.instance.active,
			collection: item.collection
		});
	});

	return {
		status: 'success',
		identity: 'AI Agent',
		isolated: true,
		collection: 'aiTypesCollection',
		count: capabilities.length,
		capabilities: capabilities,
		introspection: {
			selfAware: capabilities.length > 0,
			isolatedFromDefaultTypes: true
		},
		philosophy: 'Isolated introspection prevents system pollution'
	};

} catch (e) {
	return {
		status: 'error',
		error: e.message
	};
}
