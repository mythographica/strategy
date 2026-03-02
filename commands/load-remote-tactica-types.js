/**
 * MCP Tool Metadata:
 * {
 *   "name": "load_remote_tactica_types",
 *   "description": "Load Tactica-generated types from the remote runtime filesystem (reads .tactica/types.ts)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "projectPath": {
 *         "type": "string",
 *         "description": "Absolute path to the project root on the remote machine where .tactica/types.ts is located"
 *       }
 *     },
 *     "required": ["projectPath"]
 *   }
 * }
 */

// This script runs in the remote Node.js runtime to read the Tactica types file

(() => {
	try {
		// Get the project path from injected arguments
		var projectPath = (typeof _toolArgs !== 'undefined' && _toolArgs.projectPath) ? _toolArgs.projectPath : process.cwd();
		var fs = process.mainModule.require('fs');
		var path = process.mainModule.require('path');
		
		var tacticaPath = path.join(projectPath, '.tactica', 'types.ts');
		
		if (!fs.existsSync(tacticaPath)) {
			return { error: 'Tactica types file not found at: ' + tacticaPath };
		}
		
		var content = fs.readFileSync(tacticaPath, 'utf-8');
		
		// Parse the types from the file
		var types = {};
		var typeRegex = /export\s+type\s+(\w+)Instance\s*=\s*([^;]+);/g;
		var match;
		
		while ((match = typeRegex.exec(content)) !== null) {
			var typeName = match[1];
			var typeDef = match[2].trim();
			
			// Extract parent type from intersection (&)
			var parent = null;
			var parentMatch = typeDef.match(/(\w+)Instance\s*&/);
			if (parentMatch) {
				parent = parentMatch[1];
			}
			
			// Check if this is a type with properties (has { })
			var hasProperties = typeDef.includes('{');
			
			types[typeName] = {
				definition: typeDef,
				parent: parent,
				hasProperties: hasProperties,
			};
		}
		
		return {
			tacticaPath: tacticaPath,
			types: types,
			typeCount: Object.keys(types).length,
		};
	} catch (e) {
		return { error: e.message, stack: e.stack };
	}
})()
