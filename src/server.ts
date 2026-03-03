'use strict';

import * as fs from 'fs';
import * as path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadCommands, listCommands, getCommandHelp, getCommandPath, isLocalCommand, type CommandContext } from './command-loader';

/**
 * Symbol for store metadata
 */
export const StoreMeta = Symbol.for('StrategyMCP.meta');

/**
 * Context passed to commands
 */
export interface CommandExecContext {
	require: NodeRequire;
	args: Record<string, unknown>;
	store: Map<string | symbol, unknown>;
	[key: string]: unknown;
}

/**
 * Execute a command
 * @param filePath - Full path to command file
 * @param args - Arguments to pass to the command
 * @returns Result of the command execution
 */
async function executeCommand (
	filePath: string,
	args: Record<string, unknown>
): Promise<unknown> {
	if (!fs.existsSync(filePath)) {
		throw new Error(`Command file not found: ${filePath}`);
	}

	// Read the code first to check pattern
	const code = fs.readFileSync(filePath, 'utf-8');

	// Build context - passed to command
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const g = global as Record<string, any>;
	const ctx: CommandExecContext = {
		require,
		args,
		store: g.StrategyMCP
	};

	// If it has module.exports with run function, use require
	if (isLocalCommand(code)) {
		// Clear require cache to allow reloading
		delete require.cache[require.resolve(filePath)];

		// Require the module
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const commandModule = require(filePath);

		if (typeof commandModule.run === 'function') {
			return await commandModule.run(ctx);
		}

		throw new Error(`Command does not export a 'run' function`);
	}

	// Otherwise, treat as remote-style IIFE command
	// Wrap it to capture the result - always wrap in async IIFE
	const wrappedBody = `
		return (async function() {
			${code}
		})();
	`;

	// Execute in a sandbox-like way using Function with ctx parameter
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const fn = new Function('ctx', wrappedBody);
	const result = fn(ctx);

	// Always await the result since we wrap in async IIFE
	return await result;
}

/**
 * Strategy MCP Server
 * Provides AI agents with runtime Mnemonica analysis via Chrome Debug Protocol
 * Refactored to expose only 3 bundled tools: execute, list, help
 */
export class StrategyServer {
	private server: Server;

	constructor () {
		// Initialize global shared state for commands
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const g = global as unknown as Record<string, unknown>;
		if (!g.StrategyMCP) {
			const store = new Map<string | symbol, unknown>();
			store.set(StoreMeta, {
				initialized: Date.now(),
				version: '1.0'
			});
			g.StrategyMCP = store;
		}

		this.server = new Server(
			{
				name: '@mnemonica/strategy',
				version: '0.1.0',
			},
			{
				capabilities: {
					tools: {},
				},
			}
		);

		this.setupToolHandlers();
	}

	private setupToolHandlers (): void {
		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			return {
				tools: [
					{
						name: 'execute',
						description: 'Execute a command in the specified context (MCP, RPC, or RUN)',
						inputSchema: {
							type: 'object',
							properties: {
								context: {
									type: 'string',
									enum: ['MCP', 'RPC', 'RUN'],
									description: 'Execution context: MCP (local), RPC (remote/CDP), or RUN (VS Code HTTP)',
								},
								command: {
									type: 'string',
									description: 'Command name to execute',
								},
								args: {
									type: 'object',
									description: 'Command arguments',
									additionalProperties: true,
								},
							},
							required: ['context', 'command'],
						},
					},
					{
						name: 'list',
						description: 'List all available commands grouped by context and folder',
						inputSchema: {
							type: 'object',
							properties: {
								context: {
									type: 'string',
									enum: ['MCP', 'RPC', 'RUN', 'ALL'],
									description: 'Filter by context (default: ALL)',
								},
							},
						},
					},
					{
						name: 'help',
						description: 'Get detailed help for a specific command including examples',
						inputSchema: {
							type: 'object',
							properties: {
								context: {
									type: 'string',
									enum: ['MCP', 'RPC', 'RUN'],
									description: 'Command context',
								},
								command: {
									type: 'string',
									description: 'Command name to get help for',
								},
							},
							required: ['context', 'command'],
						},
					},
				],
			};
		});

		this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
			const { name, arguments: args } = request.params;

			switch (name) {
				case 'execute': {
					const { context, command, args: commandArgs = {} } = args as {
						context: CommandContext;
						command: string;
						args?: Record<string, unknown>;
					};

					if (!context || !command) {
						return {
							content: [{ type: 'text', text: 'Error: context and command are required' }],
							isError: true,
						};
					}

					// Get command file path
					const filePath = getCommandPath(context, command);

					if (!filePath) {
						return {
							content: [{ type: 'text', text: `Error: Command '${command}' not found in context '${context}'` }],
							isError: true,
						};
					}

					// Execute command
					try {
						const result = await executeCommand(filePath, commandArgs);
						return {
							content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
						};
					} catch (e) {
						return {
							content: [{ type: 'text', text: `Error executing command: ${e instanceof Error ? e.message : String(e)}` }],
							isError: true,
						};
					}
				}

				case 'list': {
					const { context = 'ALL' } = args as { context?: CommandContext | 'ALL' };

					let commands;
					if (context === 'ALL') {
						commands = listCommands();
					} else {
						commands = listCommands(context);
					}

					// Group by context for better readability
					const grouped = commands.reduce((acc, cmd) => {
						if (!acc[cmd.context]) {
							acc[cmd.context] = [];
						}
						acc[cmd.context].push(cmd);
						return acc;
					}, {} as Record<string, typeof commands>);

					const summary = Object.entries(grouped).map(([ctx, cmds]) => {
						const byFolder = cmds.reduce((acc, cmd) => {
							const folder = cmd.folder || 'root';
							if (!acc[folder]) acc[folder] = [];
							acc[folder].push(cmd.name);
							return acc;
						}, {} as Record<string, string[]>);

						let text = `\n=== ${ctx} ===\n`;
						Object.entries(byFolder).forEach(([folder, names]) => {
							text += `  ${folder}/: ${names.join(', ')}\n`;
						});
						return text;
					}).join('\n');

					return {
						content: [
							{ type: 'text', text: `Available commands (${commands.length} total):${summary}` },
						],
					};
				}

				case 'help': {
					const { context, command } = args as {
						context: CommandContext;
						command: string;
					};

					if (!context || !command) {
						return {
							content: [{ type: 'text', text: 'Error: context and command are required' }],
							isError: true,
						};
					}

					const help = getCommandHelp(context, command);

					if (!help) {
						return {
							content: [{ type: 'text', text: `No help found for command '${command}' in context '${context}'` }],
							isError: true,
						};
					}

					// Format help nicely
					let text = `# ${help.name}\n\n`;
					text += `${help.description}\n\n`;

					if (help.inputSchema && help.inputSchema.properties) {
						text += `## Parameters\n\n`;
						const props = help.inputSchema.properties as Record<string, { type: string; description?: string; enum?: string[] }>;
						Object.entries(props).forEach(([key, val]) => {
							text += `- **${key}** (${val.type}${val.enum ? `, enum: [${val.enum.join(', ')}]` : ''}): ${val.description || ''}\n`;
						});
						text += '\n';
					}

					if (help.examples && help.examples.length > 0) {
						text += `## Examples\n\n`;
						help.examples.forEach((ex, i) => {
							text += `${i + 1}. **${ex.description}**\n`;
							text += `   \`\`\`json\n   ${JSON.stringify(ex.execute.args, null, 2)}\n   \`\`\`\n\n`;
						});
					}

					return {
						content: [{ type: 'text', text }],
					};
				}

				default: {
					return {
						content: [{ type: 'text', text: `Unknown tool: ${name}` }],
						isError: true,
					};
				}
			}
		});
	}

	async run (): Promise<void> {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		console.error('Strategy MCP server running on stdio');
	}
}
