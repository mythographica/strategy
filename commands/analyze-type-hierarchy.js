/**
 * MCP Tool Metadata:
 * {
 *   "name": "analyze_type_hierarchy",
 *   "description": "Analyze the complete Mnemonica type hierarchy with recursive subtype traversal and depth calculation",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

// This script analyzes the complete type hierarchy from the runtime
// It traverses both defaultCollection (root types) and .subtypes (child types)

(() => {
	try {
		var mnemonica = process.mainModule.require('mnemonica');
		var collection = mnemonica.defaultCollection;

		var result = {
			totalTypes: 0,
			rootTypes: [],
			maxDepth: 0,
			tree: {}
		};

		// Type map to store all discovered types
		var typeMap = {};

		// Helper to safely get type name from constructor
		function getTypeName (Constructor) {
			try {
				var symbols = Object.getOwnPropertySymbols(Constructor);
				for (var i = 0; i < symbols.length; i++) {
					if (symbols[i].toString() === 'Symbol(constructor-name)') {
						return Constructor[symbols[i]];
					}
				}
				return Constructor.name || Constructor.TypeName;
			} catch (e) {
				return null;
			}
		}

		// Helper to iterate subtypes using the Proxy API
		function forEachSubtype (Constructor, callback) {
			try {
				Constructor.subtypes.forEach(callback);
			} catch (e) {}
		}

		// Helper to get parent from constructor
		function getParent (Constructor) {
			try {
				return Constructor.parent;
			} catch (e) {
				return null;
			}
		}

		// Recursively discover all types starting from a root constructor
		function discoverTypes (Constructor, parentName, depth) {
			if (typeof Constructor !== 'function') {
				return;
			}

			var name = getTypeName(Constructor);
			if (!name || typeMap[name]) {
				return;
			}

			// Record this type
			typeMap[name] = {
				name: name,
				parent: parentName,
				subtypes: [],
				depth: depth
			};
			result.totalTypes++;

			if (depth > result.maxDepth) {
				result.maxDepth = depth;
			}

			// If it has a parent, add to parent's subtypes list
			if (parentName && typeMap[parentName]) {
				typeMap[parentName].subtypes.push(name);
			}

			// Recursively discover subtypes
			forEachSubtype(Constructor, function (subConstructor) {
				discoverTypes(subConstructor, name, depth + 1);
			});
		}

		// Start discovery from all root types in defaultCollection
		collection.forEach(function (Constructor, name) {
			if (typeof Constructor === 'function') {
				result.rootTypes.push(name);
				discoverTypes(Constructor, null, 0);
			}
		});

		// Build tree structure for output
		function buildTree (name) {
			var type = typeMap[name];
			if (!type) return null;

			var node = {
				name: name,
				depth: type.depth,
				children: []
			};

			for (var i = 0; i < type.subtypes.length; i++) {
				var child = buildTree(type.subtypes[i]);
				if (child) {
					node.children.push(child);
				}
			}

			return node;
		}

		// Build trees for each root
		for (var i = 0; i < result.rootTypes.length; i++) {
			var rootName = result.rootTypes[i];
			var tree = buildTree(rootName);
			if (tree) {
				result.tree[rootName] = tree;
			}
		}

		// Also create a flat list of all types with their info
		result.allTypes = Object.keys(typeMap).map(function (name) {
			return {
				name: name,
				parent: typeMap[name].parent,
				depth: typeMap[name].depth,
				hasChildren: typeMap[name].subtypes.length > 0
			};
		});

		return result;
	} catch (error) {
		return {
			error: error.message,
			stack: error.stack
		};
	}
})();
