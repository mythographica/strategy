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

// Analyze the complete type hierarchy from the runtime
// Executes in NestJS via CDP

var { require, args } = ctx;

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
	console.log('');
	console.log('=== NESTJS EXECUTION: analyze-type-hierarchy ===');
	console.log('Analyzing type hierarchy in NestJS runtime via CDP');
	console.log('Timestamp: ' + new Date().toISOString());
	console.log('Process PID: ' + process.pid);
	console.log('=================================================');

	var mnemonica = require('mnemonica');
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
				if (symbols[i].toString() === 'Symbol(constructor name)') {
					return Constructor[symbols[i]];
				}
			}
			return Constructor.name || 'anonymous';
		} catch (e) {
			return 'unknown';
		}
	}

	// Helper to get parent type name
	function getParent (Constructor) {
		try {
			var proto = Object.getPrototypeOf(Constructor.prototype);
			if (proto && proto.constructor) {
				return getTypeName(proto.constructor);
			}
		} catch (e) {}
		return null;
	}

	// Recursive function to discover types
	function discoverTypes (Constructor, parentName, depth) {
		var name = getTypeName(Constructor);

		if (typeMap[name]) {
			return; // Already discovered
		}

		result.totalTypes++;
		if (depth > result.maxDepth) {
			result.maxDepth = depth;
		}

		typeMap[name] = {
			name: name,
			parent: parentName,
			depth: depth,
			hasSubtypes: false,
			subtypes: []
		};

		// Check for subtypes
		var subtypes = Constructor.subtypes;
		if (subtypes && subtypes.size > 0) {
			typeMap[name].hasSubtypes = true;
			subtypes.forEach(function (SubConstructor, subName) {
				typeMap[name].subtypes.push(subName);
				discoverTypes(SubConstructor, name, depth + 1);
			});
		}

		// Root types have no parent
		if (!parentName) {
			result.rootTypes.push(name);
		}
	}

	// Start discovery from defaultCollection
	if (collection) {
		collection.forEach(function (Constructor, name) {
			discoverTypes(Constructor, null, 0);
		});
	}

	// Also check defaultTypes (use Object.getOwnPropertyNames to avoid proxy issues)
	if (mnemonica.defaultTypes) {
		var dt = mnemonica.defaultTypes;
		try {
			var dtKeys = Object.getOwnPropertyNames(dt);
			dtKeys.forEach(function (key) {
				try {
					var val = dt[key];
					if (typeof val === 'function' && !typeMap[key]) {
						discoverTypes(val, null, 0);
					}
				} catch (e) {
					// Skip properties that can't be accessed
				}
			});
		} catch (e) {
			// defaultTypes might be a proxy, skip if problematic
		}
	}

	// Build tree structure
	function buildTree (name) {
		var type = typeMap[name];
		if (!type) return null;

		var node = {
			name: name,
			children: []
		};

		if (type.subtypes.length > 0) {
			type.subtypes.forEach(function (subName) {
				var child = buildTree(subName);
				if (child) {
					node.children.push(child);
				}
			});
		}

		return node;
	}

	result.rootTypes.forEach(function (rootName) {
		result.tree[rootName] = buildTree(rootName);
	});

	// Summary
	result.summary = {
		total: result.totalTypes,
		roots: result.rootTypes.length,
		maxDepth: result.maxDepth,
		rootsList: result.rootTypes
	};

	return {
		success: true,
		action: 'analyze',
		...result
	};

} catch (e) {
	return {
		success: false,
		action: 'analyze',
		error: e.message,
		stack: e.stack
	};
}
