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
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const command_loader_1 = require("./command-loader");
/**
 * Execute a command locally (MCP context)
 * For remote-style commands (IIFE), we read the file and wrap it
 * For local-style commands (module.exports), we require them
 * @param filePath - Full path to command file
 * @param args - Arguments to pass to the command
 * @returns Result of the command execution
 */
async function executeLocalCommand(filePath, args) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Command file not found: ${filePath}`);
    }
    // Read the code first to check pattern
    const code = fs.readFileSync(filePath, 'utf-8');
    // If it has module.exports with run function, use require
    if ((0, command_loader_1.isLocalCommand)(code)) {
        // Clear require cache to allow reloading
        delete require.cache[require.resolve(filePath)];
        // Require the module
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const commandModule = require(filePath);
        if (typeof commandModule.run === 'function') {
            return await commandModule.run(args);
        }
        throw new Error(`Command does not export a 'run' function`);
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
 * Refactored to expose only 3 bundled tools: execute, list, help
 */
class StrategyServer {
    constructor() {
        this.server = new index_js_1.Server({
            name: '@mnemonica/strategy',
            version: '0.2.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupToolHandlers();
    }
    setupToolHandlers() {
        // List available tools - only 3 bundled tools
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
            const tools = [
                {
                    name: 'execute',
                    description: 'Execute a command from commands-mcp, commands-remote, or commands-run folders',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            context: {
                                type: 'string',
                                enum: ['MCP', 'RPC', 'RUN'],
                                description: 'MCP=local, RPC=remote/CDP, RUN=VS Code HTTP',
                            },
                            command: {
                                type: 'string',
                                description: 'Command filename without .js extension',
                            },
                            args: {
                                type: 'object',
                                description: 'Arguments passed to the command',
                            },
                        },
                        required: ['context', 'command'],
                    },
                },
                {
                    name: 'list',
                    description: 'List available commands by context (like ls for commands)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            context: {
                                type: 'string',
                                enum: ['MCP', 'RPC', 'RUN', 'ALL'],
                                default: 'ALL',
                                description: 'Which context to list commands from',
                            },
                        },
                    },
                },
                {
                    name: 'help',
                    description: 'Get detailed help for any command including description, parameters, and examples (like man in Linux)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            context: {
                                type: 'string',
                                enum: ['MCP', 'RPC', 'RUN'],
                                description: 'Which command folder',
                            },
                            command: {
                                type: 'string',
                                description: 'Command name to get help for',
                            },
                        },
                        required: ['context', 'command'],
                    },
                },
            ];
            return { tools };
        });
        // Handle tool calls
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            switch (name) {
                case 'execute': {
                    const { context, command, args: commandArgs = {} } = args;
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
                    // Handle based on context
                    if (context === 'MCP') {
                        // Execute locally
                        try {
                            const result = await executeLocalCommand(filePath, commandArgs);
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
                    else if (context === 'RPC' || context === 'RUN') {
                        // For now, RPC and RUN context commands execute locally
                        // In a full implementation, these would execute remotely
                        // Execute locally using fs.readFile + new Function
                        try {
                            const result = await executeLocalCommand(filePath, commandArgs);
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
                            content: [{ type: 'text', text: `Command '${command}' not found in context '${context}'` }],
                            isError: true,
                        };
                    }
                    // Format help output
                    let output = `\nNAME\n    ${help.name}\n\n`;
                    output += `CONTEXT\n    ${help.context}${help.folder ? `/${help.folder}` : ''}\n\n`;
                    output += `DESCRIPTION\n    ${help.description}\n\n`;
                    if (help.inputSchema && help.inputSchema.properties) {
                        output += `PARAMETERS\n`;
                        const props = help.inputSchema.properties;
                        const required = help.inputSchema.required || [];
                        Object.entries(props).forEach(([key, val]) => {
                            const typeStr = val.enum ? `enum(${val.enum.join('|')})` : val.type;
                            const req = required.includes(key) ? ' (required)' : '';
                            output += `    ${key}: ${typeStr}${req}\n`;
                            if (val.description) {
                                output += `        ${val.description}\n`;
                            }
                        });
                        output += '\n';
                    }
                    if (help.examples.length > 0) {
                        output += `EXAMPLES\n`;
                        help.examples.forEach((ex, i) => {
                            output += `    ${i + 1}. ${ex.description}\n`;
                            output += `       execute(${JSON.stringify(ex.execute)})\n\n`;
                        });
                    }
                    if (help.related.length > 0) {
                        output += `SEE ALSO\n    ${help.related.join(', ')}\n`;
                    }
                    return {
                        content: [{ type: 'text', text: output }],
                    };
                }
                default: {
                    return {
                        content: [{ type: 'text', text: `Unknown tool: ${name}. Available tools: execute, list, help` }],
                        isError: true,
                    };
                }
            }
        });
    }
    async run() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        console.error('Mnemonica Strategy MCP server running on stdio');
        console.error('Tools: execute, list, help (3 bundled MCP tools)');
        console.error('Use: list {context: "ALL"} to see all available commands');
    }
}
exports.StrategyServer = StrategyServer;
//# sourceMappingURL=server.js.map