/**
 * MCP Tool Metadata:
 * {
 *   "name": "list_mcp_commands",
 *   "description": "List all available MCP commands/tools with their descriptions and schemas (Swagger-like)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

// List all available MCP commands with metadata (Swagger-like documentation)
// NOTE: This file should NOT use an outer IIFE - the server's executeLocalCommand
// wraps it properly and needs to capture the return value

try {
	var fs = process.mainModule.require('fs');
	var path = process.mainModule.require('path');

	// Get the commands directory
	var commandsDir = '/code/mnemonica/strategy/commands';

	// Read all command files
	var files = fs.readdirSync(commandsDir).filter(function (f) {
		return f.endsWith('.js');
	});

	var commands = [];

	files.forEach(function (file) {
		var filePath = path.join(commandsDir, file);
		var content = fs.readFileSync(filePath, 'utf-8');

		// Extract MCP Tool Metadata from comment block
		var metadataMatch = content.match(/\/\*\*\s*\n\s*\*\s*MCP Tool Metadata:\s*\n([\s\S]*?)\n\s*\*\//);

		if (metadataMatch) {
			try {
				var jsonStr = metadataMatch[1].replace(/^\s*\*\s?/gm, '');
				var metadata = JSON.parse(jsonStr);

				commands.push({
					name: metadata.name,
					description: metadata.description,
					inputSchema: metadata.inputSchema,
					file: file,
					endpoint: 'dynamic_tool',
					usage: {
						remote: {
							commandName: file.replace('.js', ''),
							remote: true
						},
						local: {
							commandName: file.replace('.js', ''),
							remote: false
						}
					}
				});
			} catch (e) {
				// Parse error, skip
			}
		}
	});

	// Built-in commands
	var builtInCommands = [
		{
			name: 'connect_to_runtime',
			description: 'Connect to Node.js debug runtime (default: localhost:9229)',
			inputSchema: {
				type: 'object',
				properties: {
					host: { type: 'string', default: 'localhost' },
					port: { type: 'number', default: 9229 }
				}
			},
			endpoint: 'direct',
			category: 'connection'
		},
		{
			name: 'disconnect_from_runtime',
			description: 'Disconnect from Node.js runtime',
			inputSchema: { type: 'object', properties: {} },
			endpoint: 'direct',
			category: 'connection'
		},
		{
			name: 'load_tactica_types',
			description: 'Load Tactica-generated types from .tactica folder',
			inputSchema: {
				type: 'object',
				properties: {
					projectPath: { type: 'string', description: 'Path to project with .tactica folder' }
				},
				required: ['projectPath']
			},
			endpoint: 'direct',
			category: 'tactica'
		},
		{
			name: 'compare_with_tactica',
			description: 'Compare runtime types with Tactica-generated types',
			inputSchema: {
				type: 'object',
				properties: {
					projectPath: { type: 'string', description: 'Path to project with .tactica folder' }
				},
				required: ['projectPath']
			},
			endpoint: 'direct',
			category: 'tactica'
		},
		{
			name: 'dynamic_tool',
			description: 'Execute any command from the commands directory by filename',
			inputSchema: {
				type: 'object',
				properties: {
					commandName: { type: 'string', description: 'Name of command file (without .js)' },
					args: { type: 'object', description: 'Arguments to pass' },
					remote: { type: 'boolean', description: 'Execute via CDP (true) or locally (false)' }
				},
				required: ['commandName']
			},
			endpoint: 'direct',
			category: 'meta'
		}
	];

	return {
		apiVersion: '1.0.0',
		service: 'Mnemonica Strategy MCP',
		description: 'MCP Server for Mnemonica runtime analysis via Chrome Debug Protocol',
		endpoints: {
			direct: 'Built-in MCP tools (no remote execution needed)',
			dynamic: 'Commands from strategy/commands/ directory'
		},
		builtInCommands: builtInCommands,
		dynamicCommands: {
			count: commands.length,
			commands: commands
		},
		usage: {
			example: {
				createType: {
					description: 'Create a new Mnemonica type in NestJS',
					request: {
						name: 'dynamic_tool',
						arguments: {
							commandName: 'create-test-type',
							args: { typeName: 'MyType' },
							remote: true
						}
					}
				}
			}
		}
	};

} catch (error) {
	return {
		success: false,
		error: error.message,
		stack: error.stack
	};
}
