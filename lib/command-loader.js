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
exports.listCommands = listCommands;
exports.getCommandHelp = getCommandHelp;
exports.getCommandPath = getCommandPath;
exports.getCommandCode = getCommandCode;
exports.isLocalCommand = isLocalCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Folder configuration for each context
 */
const CONTEXT_FOLDERS = {
    MCP: 'commands-mcp',
    RPC: 'commands-remote',
    RUN: 'commands-run',
};
/**
 * Parse MCP tool metadata from JavaScript file comments
 * Looks for:
 * /**
 *  * MCP Tool Metadata:
 *  * { ...json... }
 *  *
 */
function parseMetadata(content) {
    const metadataMatch = content.match(/\/\*\*\s*\n\s*\*\s*MCP Tool Metadata:\s*\n\s*\*\s*({[\s\S]*?})\s*\n\s*\*\//);
    if (!metadataMatch) {
        return null;
    }
    try {
        // Parse the JSON from the comment
        const jsonStr = metadataMatch[1].replace(/\n\s*\*\s*/g, ' ');
        const metadata = JSON.parse(jsonStr);
        // Note: excludeFromMCP is no longer relevant in v5 architecture
        // All commands are executed through the 3 bundled tools
        return metadata;
    }
    catch {
        return null;
    }
}
/**
 * Recursively load commands from a directory
 */
function loadCommandsFromDir(dirPath, context, folder) {
    const commands = [];
    if (!fs.existsSync(dirPath)) {
        return commands;
    }
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            // Recursively load from subdirectories
            const subCommands = loadCommandsFromDir(entryPath, context, entry.name);
            commands.push(...subCommands);
        }
        else if (entry.isFile() && entry.name.endsWith('.js')) {
            const content = fs.readFileSync(entryPath, 'utf-8');
            const metadata = parseMetadata(content);
            if (metadata) {
                commands.push({
                    name: metadata.name,
                    filePath: entryPath,
                    context,
                    folder,
                    metadata,
                    code: content,
                });
            }
        }
    }
    return commands;
}
/**
 * Load all commands from all context folders
 */
function loadCommands(context) {
    const baseDir = path.join(__dirname, '..');
    const commands = [];
    if (context) {
        // Load only specified context
        const folder = CONTEXT_FOLDERS[context];
        const dirPath = path.join(baseDir, folder);
        commands.push(...loadCommandsFromDir(dirPath, context, ''));
    }
    else {
        // Load all contexts
        for (const [ctx, folder] of Object.entries(CONTEXT_FOLDERS)) {
            const dirPath = path.join(baseDir, folder);
            commands.push(...loadCommandsFromDir(dirPath, ctx, ''));
        }
    }
    return commands;
}
/**
 * Get list of commands for a specific context
 * Returns simplified info for list command
 */
function listCommands(context) {
    const commands = loadCommands(context);
    return commands.map(cmd => ({
        name: cmd.metadata.name,
        context: cmd.context,
        folder: cmd.folder,
        description: cmd.metadata.description,
    }));
}
/**
 * Get detailed help for a specific command
 */
function getCommandHelp(context, commandName) {
    const commands = loadCommands(context);
    const command = commands.find(cmd => cmd.metadata.name === commandName);
    if (!command) {
        return null;
    }
    // Build examples from metadata or generate defaults
    const examples = command.metadata.examples || [];
    const formattedExamples = examples.map(ex => ({
        description: ex.description,
        execute: {
            context: command.context,
            command: command.metadata.name,
            args: ex.args,
        },
    }));
    // Find related commands in same folder
    const related = commands
        .filter(cmd => cmd.folder === command.folder && cmd.metadata.name !== commandName)
        .map(cmd => cmd.metadata.name);
    return {
        name: command.metadata.name,
        description: command.metadata.description,
        context: command.context,
        folder: command.folder,
        inputSchema: command.metadata.inputSchema,
        examples: formattedExamples,
        related: related.slice(0, 5), // Limit to 5 related
    };
}
/**
 * Get command file path by name and context
 */
function getCommandPath(context, commandName) {
    const commands = loadCommands(context);
    const command = commands.find(cmd => cmd.metadata.name === commandName);
    return command ? command.filePath : null;
}
/**
 * Get command code for a specific tool name and context
 */
function getCommandCode(context, name) {
    const commands = loadCommands(context);
    const command = commands.find(cmd => cmd.metadata.name === name);
    return command ? command.code : null;
}
/**
 * Check if command should run locally (has module.exports.run)
 */
function isLocalCommand(code) {
    return code.includes('module.exports') && code.includes('run');
}
//# sourceMappingURL=command-loader.js.map