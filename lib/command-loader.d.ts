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
}
/**
 * Command file with metadata and code
 */
interface CommandFile {
    name: string;
    filePath: string;
    metadata: ToolDefinition;
    code: string;
}
/**
 * Load all commands from the commands directory
 */
export declare function loadCommands(): CommandFile[];
/**
 * Get tool definitions for ListToolsRequest
 */
export declare function getToolDefinitions(): ToolDefinition[];
/**
 * Get command code for a specific tool name
 */
export declare function getCommandCode(name: string): string | null;
export {};
//# sourceMappingURL=command-loader.d.ts.map