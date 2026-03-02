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
exports.loadCommands = loadCommands;
exports.getToolDefinitions = getToolDefinitions;
exports.getCommandCode = getCommandCode;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Parse MCP tool metadata from JavaScript file comments
 * Looks for:
 * /**
 *  * MCP Tool Metadata:
 *  * { ...json... }
 *  *
 /
 */
function parseMetadata(content) {
    const metadataMatch = content.match(/\/\*\*\s*\n\s*\*\s*MCP Tool Metadata:\s*\n\s*\*\s*({[\s\S]*?})\s*\n\s*\*\//);
    if (!metadataMatch) {
        return null;
    }
    try {
        // Parse the JSON from the comment
        const jsonStr = metadataMatch[1].replace(/\n\s*\*\s*/g, ' ');
        return JSON.parse(jsonStr);
    }
    catch {
        return null;
    }
}
/**
 * Load all commands from the commands directory
 */
function loadCommands() {
    const commandsDir = path.join(__dirname, '..', 'commands');
    const commands = [];
    if (!fs.existsSync(commandsDir)) {
        console.error(`Commands directory not found: ${commandsDir}`);
        return commands;
    }
    const files = fs.readdirSync(commandsDir);
    for (const file of files) {
        if (!file.endsWith('.js')) {
            continue;
        }
        const filePath = path.join(commandsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const metadata = parseMetadata(content);
        if (metadata) {
            commands.push({
                name: metadata.name,
                filePath,
                metadata,
                code: content,
            });
        }
    }
    return commands;
}
/**
 * Get tool definitions for ListToolsRequest
 */
function getToolDefinitions() {
    const commands = loadCommands();
    return commands.map(cmd => ({
        name: cmd.metadata.name,
        description: cmd.metadata.description,
        inputSchema: cmd.metadata.inputSchema,
    }));
}
/**
 * Get command code for a specific tool name
 */
function getCommandCode(name) {
    const commands = loadCommands();
    const command = commands.find(cmd => cmd.metadata.name === name);
    return command ? command.code : null;
}
//# sourceMappingURL=command-loader.js.map