'use strict';

import * as fs from 'fs';
import * as path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
	CallToolRequestSchema,
	ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CDPConnection } from './cdp-connection';
import { TacticaComparison } from './tactica-comparison';
import { getToolDefinitions, getCommandCode } from './command-loader';

/**
 * Execute a command locally
 * For remote-style commands (IIFE), we read the file and wrap it
 * For local-style commands (module.exports), we require them
 * @param commandName - Name of the command file (without .js)
 * @param args - Arguments to pass to the command
 * @returns Result of the command execution
 */
async function executeLocalCommand (commandName: string, args: Record<string, unknown>): Promise<unknown> {
	const commandsDir = path.join(__dirname, '..', 'commands');
	const filePath = path.join(commandsDir, `${commandName}.js`);
	
	if (!fs.existsSync(filePath)) {
		throw new Error(`Command file not found: ${filePath}`);
	}
	
	// Read the code first to check pattern
	const code = fs.readFileSync(filePath, 'utf-8');
	
	// If it has module.exports, use require
	if (code.includes('module.exports')) {
		// Clear require cache to allow reloading
		delete require.cache[require.resolve(filePath)];
		
		// Require the module
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const commandModule = require(filePath);
		
		if (typeof commandModule.run === 'function') {
			return await commandModule.run(args);
		}
		
		throw new Error(`Command '${commandName}' does not export a 'run' function`);
	}
	
	// Otherwise, treat as remote-style IIFE command
	// Wrap it to capture the result
	const wrappedCode = `
		var _toolArgs = ${JSON.stringify(args)};
		${code}
	`;
	
	// Execute in a sandbox-like way using Function
	const fn = new Function(wrappedCode);
	const result = fn();
	
	// If it's an async IIFE returning a promise, await it
	if (result && typeof result.then === 'function') {
		return await result;
	}
	
	return result;
}

/**
 * Strategy MCP Server
 * Provides AI agents with runtime Mnemonica analysis via Chrome Debug Protocol
 */
export class StrategyServer {
	private server: Server;
	private cdpConnection: CDPConnection;
	private tacticaComparison: TacticaComparison;

	constructor () {
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

		this.cdpConnection = new CDPConnection('localhost', 9229);
		this.tacticaComparison = new TacticaComparison();

		this.setupToolHandlers();
	}

	private setupToolHandlers (): void {
		// List available tools - dynamically loaded from commands/ directory + built-ins
		this.server.setRequestHandler(ListToolsRequestSchema, async () => {
			// Built-in tools that don't need runtime evaluation
			const builtInTools = [
				{
					name: 'connect_to_runtime',
					description: 'Connect to Node.js debug runtime (default: localhost:9229)',
					inputSchema: {
						type: 'object',
						properties: {
							host: { type: 'string', default: 'localhost' },
							port: { type: 'number', default: 9229 },
						},
					},
				},
				{
					name: 'disconnect_from_runtime',
					description: 'Disconnect from Node.js runtime',
					inputSchema: { type: 'object', properties: {} },
				},
				{
					name: 'load_tactica_types',
					description: 'Load Tactica-generated types from .tactica folder',
					inputSchema: {
						type: 'object',
						properties: {
							projectPath: {
								type: 'string',
								description: 'Path to project with .tactica folder',
							},
						},
						required: ['projectPath'],
					},
				},
				{
					name: 'compare_with_tactica',
					description: 'Compare runtime types with Tactica-generated types',
					inputSchema: {
						type: 'object',
						properties: {
							projectPath: {
								type: 'string',
								description: 'Path to project with .tactica folder',
							},
						},
						required: ['projectPath'],
					},
				},
				{
					name: 'dynamic_tool',
					description: 'Execute any command from the commands directory by filename (locally or remotely)',
					inputSchema: {
						type: 'object',
						properties: {
							commandName: {
								type: 'string',
								description: 'Name of the command file to execute (without .js extension)',
							},
							args: {
								type: 'object',
								description: 'Arguments to pass to the command',
							},
							remote: {
								type: 'boolean',
								description: 'Execute remotely via CDP (requires connect_to_runtime). Default: false (local execution)',
							},
						},
						required: ['commandName'],
					},
				},
			];

			// Dynamically loaded tools from commands/ directory
			const dynamicTools = getToolDefinitions();

			return {
				tools: [...builtInTools, ...dynamicTools],
			};
		});

		// Handle tool calls
		this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
			const { name, arguments: args } = request.params;

			switch (name) {
				case 'connect_to_runtime': {
					const { host = 'localhost', port = 9229 } = args as { host?: string; port?: number };
					this.cdpConnection = new CDPConnection(host, port);
					await this.cdpConnection.connect();
					return {
						content: [{ type: 'text', text: `Connected to ${host}:${port}` }],
					};
				}

				case 'disconnect_from_runtime': {
					await this.cdpConnection.disconnect();
					return {
						content: [{ type: 'text', text: 'Disconnected from runtime' }],
					};
				}

				case 'load_tactica_types': {
					const { projectPath } = args as { projectPath: string };
					const types = this.tacticaComparison.loadTacticaTypes(projectPath);
					return {
						content: [{ type: 'text', text: JSON.stringify(types, null, 2) }],
					};
				}

				case 'compare_with_tactica': {
					const { projectPath } = args as { projectPath: string };

					if (!this.cdpConnection.isConnected()) {
						return {
							content: [
								{
									type: 'text',
									text: 'Error: Not connected to runtime. Use connect_to_runtime first.',
								},
							],
							isError: true,
						};
					}

					const runtimeTypes = await this.cdpConnection.getMnemonicaTypes();
					const tacticaTypes = this.tacticaComparison.loadTacticaTypes(projectPath);
					const comparison = this.tacticaComparison.compare(
						runtimeTypes as Record<string, unknown>,
						tacticaTypes
					);

					return {
						content: [
							{
								type: 'text',
								text: this.tacticaComparison.generateReport(comparison),
							},
						],
					};
				}

				case 'dynamic_tool': {
					const { commandName, args: dynamicArgs = {}, remote = false } = args as { commandName: string; args?: Record<string, unknown>; remote?: boolean };

					if (!commandName) {
						return {
							content: [{ type: 'text', text: 'Error: commandName is required' }],
							isError: true,
						};
					}

					// Check if command exists
					const commandsDir = path.join(__dirname, '..', 'commands');
					const filePath = path.join(commandsDir, `${commandName}.js`);
					
					if (!fs.existsSync(filePath)) {
						return {
							content: [{ type: 'text', text: `Error: Command '${commandName}' not found at ${filePath}` }],
							isError: true,
						};
					}

					if (remote) {
						// Execute remotely via CDP (requires connection)
						if (!this.cdpConnection.isConnected()) {
							return {
								content: [
									{
										type: 'text',
										text: 'Error: Not connected to runtime. Use connect_to_runtime first, or set remote: false.',
									},
								],
								isError: true,
							};
						}

						const code = fs.readFileSync(filePath, 'utf-8');
						const argsCode = `var _toolArgs = ${JSON.stringify(dynamicArgs)};`;
						const wrappedCode = argsCode + '\n' + code;
						const result = await this.cdpConnection.evaluate(wrappedCode);
						return {
							content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
						};
					} else {
						// Execute locally using fs.readFile + new Function
						try {
							const result = await executeLocalCommand(commandName, dynamicArgs);
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
				}

				default: {
					// Check if this is a dynamically loaded command
					const commandCode = getCommandCode(name);
					if (commandCode) {
						if (!this.cdpConnection.isConnected()) {
							return {
								content: [
									{
										type: 'text',
										text: 'Error: Not connected to runtime. Use connect_to_runtime first.',
									},
								],
								isError: true,
							};
						}
						// Inject arguments into the script
						const argsCode = `var _toolArgs = ${JSON.stringify(args)};`;
						const wrappedCode = argsCode + '\n' + commandCode;
						const result = await this.cdpConnection.evaluate(wrappedCode);
						return {
							content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
						};
					}

					throw new Error(`Unknown tool: ${name}`);
				}
			}
		});
	}

	async run (): Promise<void> {
		const transport = new StdioServerTransport();
		await this.server.connect(transport);
		console.error('Mnemonica Strategy MCP server running on stdio');
		console.error('Tools: connect_to_runtime, get_runtime_types, compare_with_tactica, etc.');
	}
}
