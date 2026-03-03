/**
 * Command context types
 */
export type CommandContext = 'MCP' | 'RPC' | 'RUN';
/**
 * Tool definition from MCP metadata
 */
interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties?: Record<string, unknown>;
        required?: string[];
    };
    examples?: Array<{
        description: string;
        args: Record<string, unknown>;
    }>;
}
/**
 * Command file with metadata and code
 */
interface CommandFile {
    name: string;
    filePath: string;
    context: CommandContext;
    folder: string;
    metadata: ToolDefinition;
    code: string;
}
/**
 * Load all commands from all context folders
 */
export declare function loadCommands(context?: CommandContext): CommandFile[];
/**
 * Get list of commands for a specific context
 * Returns simplified info for list command
 */
export declare function listCommands(context?: CommandContext): Array<{
    name: string;
    context: CommandContext;
    folder: string;
    description: string;
}>;
/**
 * Get detailed help for a specific command
 */
export declare function getCommandHelp(context: CommandContext, commandName: string): {
    name: string;
    description: string;
    context: CommandContext;
    folder: string;
    inputSchema: Record<string, unknown>;
    examples: Array<{
        description: string;
        execute: {
            context: CommandContext;
            command: string;
            args: Record<string, unknown>;
        };
    }>;
    related: string[];
} | null;
/**
 * Get command file path by name and context
 */
export declare function getCommandPath(context: CommandContext, commandName: string): string | null;
/**
 * Get command code for a specific tool name and context
 */
export declare function getCommandCode(context: CommandContext, name: string): string | null;
/**
 * Check if command should run locally (has module.exports.run)
 */
export declare function isLocalCommand(code: string): boolean;
export {};
//# sourceMappingURL=command-loader.d.ts.map