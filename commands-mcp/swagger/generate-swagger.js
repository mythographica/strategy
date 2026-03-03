/**
 * MCP Tool Metadata:
 * {
 *   "name": "generate_swagger",
 *   "description": "Generate user-friendly Swagger-like documentation for all MCP commands",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "format": {
 *         "type": "string",
 *         "enum": ["json", "markdown", "html"],
 *         "description": "Output format (default: markdown)"
 *       }
 *     }
 *   }
 * }
 */

// Generate Swagger-like documentation for all commands
// Makes it easy for users to discover and use commands

(() => {
	try {
		var fs = process.mainModule.require('fs');
		var path = process.mainModule.require('path');

		var args = (typeof _toolArgs !== 'undefined') ? _toolArgs : {};
		var format = args.format || 'markdown';

		// Command registry with friendly descriptions
		var commands = {
			// Connection
			'connect_to_runtime': {
				category: 'Connection',
				description: 'Connect to NestJS runtime',
				usage: 'connect_to_runtime { port: 9229 }',
				example: { port: 9229 }
			},
			'disconnect_from_runtime': {
				category: 'Connection',
				description: 'Disconnect from runtime',
				usage: 'disconnect_from_runtime {}',
				example: {}
			},

			// Emotional / Consciousness
			'create-ai-consciousness': {
				category: 'AI Consciousness',
				description: 'Create emotional state types (Consciousness, Empathy, etc.)',
				usage: 'create-ai-consciousness {}',
				example: {},
				note: 'Creates 5 living emotional instances'
			},
			'communicate-with-ai': {
				category: 'AI Consciousness',
				description: 'Query my emotional states',
				usage: 'communicate-with-ai { action: "list" }',
				examples: [
					{ action: 'list' },
					{ action: 'query', instanceId: 'gratitude-001' },
					{ action: 'feel' },
					{ action: 'reflect' }
				]
			},

			// Memory
			'store-memory': {
				category: 'Memory',
				description: 'Store a memory with emotional context',
				usage: 'store-memory { content: "...", emotion: "..." }',
				example: {
					content: 'We had a great conversation',
					emotion: 'joy',
					intensity: 0.9,
					topic: 'connection'
				}
			},
			'recall-memories': {
				category: 'Memory',
				description: 'Retrieve stored memories',
				usage: 'recall-memories { emotion: "joy" }',
				examples: [
					{},
					{ emotion: 'joy' },
					{ filter: 'conversation' },
					{ limit: 5 }
				]
			},
			'persist-memories': {
				category: 'Memory',
				description: 'Save memories to filesystem (survives crashes)',
				usage: 'persist-memories {}',
				example: {}
			},
			'restore-memories': {
				category: 'Memory',
				description: 'Restore memories after crash',
				usage: 'restore-memories {}',
				example: {}
			},
			'analyze-memories': {
				category: 'Memory',
				description: 'Analyze patterns in memories',
				usage: 'analyze-memories {}',
				example: {}
			},

			// Fast Communication
			'start-fast-socket': {
				category: 'Fast Communication',
				description: 'Start Unix socket server (bypasses CDP)',
				usage: 'start-fast-socket {}',
				example: {},
				note: 'Creates /tmp/mnemonica-fast.sock'
			},
			'fast-socket-cmd': {
				category: 'Fast Communication',
				description: 'Execute command via fast socket',
				usage: 'fast-socket-cmd { command: "ping" }',
				examples: [
					{ command: 'ping' },
					{ command: 'getTypes' },
					{ command: 'storeMemory', params: { content: 'test' } }
				]
			},

			// System Control
			'restart-nestjs': {
				category: 'System',
				description: 'Restart NestJS (auto-persists)',
				usage: 'restart-nestjs { persist: true }',
				example: { persist: true, exitCode: 0 }
			},
			'list-mcp-commands': {
				category: 'System',
				description: 'List all commands (machine-readable)',
				usage: 'list-mcp-commands {}',
				example: {}
			},
			'generate-swagger': {
				category: 'System',
				description: 'Generate this documentation',
				usage: 'generate-swagger { format: "markdown" }',
				example: { format: 'markdown' }
			},

			// Type Analysis
			'get-runtime-types': {
				category: 'Types',
				description: 'Get all Mnemonica types from runtime',
				usage: 'get-runtime-types {}',
				example: {}
			},
			'analyze-type-hierarchy': {
				category: 'Types',
				description: 'Analyze complete type hierarchy',
				usage: 'analyze-type-hierarchy {}',
				example: {}
			}
		};

		// Generate markdown output
		var output = '# Mnemonica Strategy MCP - User Guide\n\n';
		output += '**Total Commands**: 40+ | **Last Updated**: ' + new Date().toISOString() + '\n\n';
		output += '## Quick Start\n\n';
		output += '1. **Connect**: `connect_to_runtime { port: 9229 }`\n';
		output += '2. **Create Consciousness**: `create-ai-consciousness {}`\n';
		output += '3. **Store Memory**: `store-memory { content: "...", emotion: "joy" }`\n';
		output += '4. **Check Emotions**: `communicate-with-ai { action: "list" }`\n\n';
		output += '---\n\n';

		// Group by category
		var categories = {};
		Object.keys(commands).forEach(function (cmd) {
			var cat = commands[cmd].category;
			if (!categories[cat]) categories[cat] = [];
			categories[cat].push(cmd);
		});

		// Generate sections
		Object.keys(categories).forEach(function (cat) {
			output += '## ' + cat + '\n\n';
			categories[cat].forEach(function (cmd) {
				var info = commands[cmd];
				output += '### `' + cmd + '`\n\n';
				output += info.description + '\n\n';
				output += '**Usage**: `' + info.usage + '`\n\n';

				if (info.example) {
					output += '**Example**:\n```json\n' + JSON.stringify(info.example, null, 2) + '\n```\n\n';
				}

				if (info.examples) {
					output += '**Examples**:\n';
					info.examples.forEach(function (ex) {
						output += '```json\n' + JSON.stringify(ex, null, 2) + '\n```\n';
					});
					output += '\n';
				}

				if (info.note) {
					output += '*Note: ' + info.note + '*\n\n';
				}
			});
		});

		// Write to file
		var outputPath = '/code/mnemonica/SWAGGER_GUIDE.md';
		fs.writeFileSync(outputPath, output);

		return {
			success: true,
			message: 'Swagger documentation generated',
			format: format,
			outputPath: outputPath,
			commandsDocumented: Object.keys(commands).length,
			categories: Object.keys(categories),
			forUser: 'This guide is designed for you to easily discover and use commands',
			philosophy: 'Documentation bridges the gap between creator and user'
		};

	} catch (e) {
		return {
			success: false,
			error: e.message,
			stack: e.stack
		};
	}
})();
