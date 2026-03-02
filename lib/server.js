'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyServer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const cdp_connection_1 = require("./cdp-connection");
const tactica_comparison_1 = require("./tactica-comparison");
const command_loader_1 = require("./command-loader");
/**
 * Execute a command locally
 * For remote-style commands (IIFE), we read the file and wrap it
 * For local-style commands (module.exports), we require them
 * @param commandName - Name of the command file (without .js)
 * @param args - Arguments to pass to the command
 * @returns Result of the command execution
 */
async function executeLocalCommand(commandName, args) {
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
class StrategyServer {
    constructor() {
        this.server = new index_js_1.Server({
            name: '@mnemonica/strategy',
            version: '0.1.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.cdpConnection = new cdp_connection_1.CDPConnection('localhost', 9229);
        this.tacticaComparison = new tactica_comparison_1.TacticaComparison();
        this.setupToolHandlers();
    }
    setupToolHandlers() {
        // List available tools - dynamically loaded from commands/ directory + built-ins
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
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
            const dynamicTools = (0, command_loader_1.getToolDefinitions)();
            return {
                tools: [...builtInTools, ...dynamicTools],
            };
        });
        // Handle tool calls
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            switch (name) {
                case 'connect_to_runtime': {
                    const { host = 'localhost', port = 9229 } = args;
                    this.cdpConnection = new cdp_connection_1.CDPConnection(host, port);
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
                    const { projectPath } = args;
                    const types = this.tacticaComparison.loadTacticaTypes(projectPath);
                    return {
                        content: [{ type: 'text', text: JSON.stringify(types, null, 2) }],
                    };
                }
                case 'compare_with_tactica': {
                    const { projectPath } = args;
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
                    const comparison = this.tacticaComparison.compare(runtimeTypes, tacticaTypes);
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
                    const { commandName, args: dynamicArgs = {}, remote = false } = args;
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
                    }
                    else {
                        // Execute locally using fs.readFile + new Function
                        try {
                            const result = await executeLocalCommand(commandName, dynamicArgs);
                            return {
                                content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                            };
                        }
                        catch (e) {
                            return {
                                content: [{ type: 'text', text: `Error executing command: ${e instanceof Error ? e.message : String(e)}` }],
                                isError: true,
                            };
                        }
                    }
                }
                default: {
                    // Check if this is a dynamically loaded command
                    const commandCode = (0, command_loader_1.getCommandCode)(name);
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
    async run() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        console.error('Mnemonica Strategy MCP server running on stdio');
        console.error('Tools: connect_to_runtime, get_runtime_types, compare_with_tactica, etc.');
    }
}
exports.StrategyServer = StrategyServer;
//# sourceMappingURL=server.js.map