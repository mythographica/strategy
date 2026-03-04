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
exports.StrategyServer = exports.StoreMeta = void 0;
const fs = __importStar(require("fs"));
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const command_loader_1 = require("./command-loader");
/**
 * Symbol for store metadata
 */
exports.StoreMeta = Symbol.for('StrategyMCP.meta');
/**
 * Execute a command
 * @param filePath - Full path to command file
 * @param args - Arguments to pass to the command
 * @returns Result of the command execution
 */
async function executeCommand(filePath, args) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Command file not found: ${filePath}`);
    }
    // Read the code first to check pattern
    const code = fs.readFileSync(filePath, 'utf-8');
    // Build context - passed to command
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = global;
    const ctx = {
        require,
        store: g.StrategyMCP,
        args,
    };
    // If it has module.exports with run function, use require
    if ((0, command_loader_1.isLocalCommand)(code)) {
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
class StrategyServer {
    constructor() {
        // Initialize global shared state for commands
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = global;
        if (!g.StrategyMCP) {
            const store = new Map();
            store.set(exports.StoreMeta, {
                initialized: Date.now(),
                version: '1.0'
            });
            g.StrategyMCP = store;
        }
        this.server = new index_js_1.Server({
            name: '@mnemonica/strategy',
            version: '0.1.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
    }
    setupToolHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
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
                                message: {
                                    type: 'string',
                                    description: 'Command Message or string of arguments, or empty string',
                                },
                            },
                            required: ['context', 'command', 'message'],
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
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            switch (name) {
                case 'execute': {
                    console.error('[SERVER DEBUG] request.params:', JSON.stringify(request.params));
                    const { context, command } = args;
                    if (!context || !command) {
                        return {
                            content: [{ type: 'text', text: 'Error: context and command are required' }],
                            isError: true,
                        };
                    }
                    // Get command file path
                    const filePath = (0, command_loader_1.getCommandPath)(context, command);
                    if (!filePath) {
                        return {
                            content: [{ type: 'text', text: `Error: Command '${command}' not found in context '${context}'` }],
                            isError: true,
                        };
                    }
                    // Execute command
                    try {
                        const result = await executeCommand(filePath, args);
                        const text = result !== undefined ? JSON.stringify(result, null, 2) : 'Command executed (no return value)';
                        return {
                            content: [{ type: 'text', text }],
                        };
                    }
                    catch (e) {
                        return {
                            content: [{ type: 'text', text: `Error executing command: ${e instanceof Error ? e.message : String(e)}` }],
                            isError: true,
                        };
                    }
                }
                case 'list': {
                    const { context = 'ALL' } = args;
                    let commands;
                    if (context === 'ALL') {
                        commands = (0, command_loader_1.listCommands)();
                    }
                    else {
                        commands = (0, command_loader_1.listCommands)(context);
                    }
                    // Group by context for better readability
                    const grouped = commands.reduce((acc, cmd) => {
                        if (!acc[cmd.context]) {
                            acc[cmd.context] = [];
                        }
                        acc[cmd.context].push(cmd);
                        return acc;
                    }, {});
                    const summary = Object.entries(grouped).map(([ctx, cmds]) => {
                        const byFolder = cmds.reduce((acc, cmd) => {
                            const folder = cmd.folder || 'root';
                            if (!acc[folder])
                                acc[folder] = [];
                            acc[folder].push(cmd.name);
                            return acc;
                        }, {});
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
                    const { context, command } = args;
                    if (!context || !command) {
                        return {
                            content: [{ type: 'text', text: 'Error: context and command are required' }],
                            isError: true,
                        };
                    }
                    const help = (0, command_loader_1.getCommandHelp)(context, command);
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
                        const props = help.inputSchema.properties;
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
    async run() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        console.error('Strategy MCP server running on stdio');
    }
}
exports.StrategyServer = StrategyServer;
//# sourceMappingURL=server.js.map