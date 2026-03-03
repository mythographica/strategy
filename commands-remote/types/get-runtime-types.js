/**
 * MCP Tool Metadata:
 * {
 *   "name": "get_runtime_types",
 *   "description": "Extract Mnemonica types from the running Node.js application",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

// This script is evaluated in the Node.js debug runtime to extract Mnemonica types
// It must use ES5-compatible syntax (var instead of const/let)

(() => {
	try {
		// Use process.mainModule.require to load mnemonica
		var mnemonica = process.mainModule.require('mnemonica');

		// Access defaultCollection (Map) instead of defaultTypes (Proxy)
		var result = {};
		var collection = mnemonica.defaultCollection;

		// Iterate over the Map
		collection.forEach(function(Constructor, name) {
			try {
				if (typeof Constructor === 'function') {
					var subtypes = [];
					var parent = null;

					// Safely get subtypes
					try {
						if (Constructor.subtypes) {
							subtypes = Array.from(Constructor.subtypes.keys());
						}
					} catch (stErr) {}

					// Safely get parent
					try {
						if (Constructor.parent) {
							parent = Constructor.parent.name;
						}
					} catch (pErr) {}

					result[name] = {
						name: Constructor.name || name,
						subtypes: subtypes,
						parent: parent,
					};
				}
			} catch (constructorErr) {
				// Skip types that can't be accessed
			}
		});
		return result;
	} catch (e) {
		return { error: e.message, stack: e.stack };
	}
})()
