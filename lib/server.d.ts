/**
 * Symbol for store metadata
 */
export declare const StoreMeta: unique symbol;
/**
 * Context passed to commands
 */
export interface CommandExecContext {
    require: NodeJS.Require;
    store: Map<string | symbol, unknown>;
}
/**
 * Strategy MCP Server
 * Provides AI agents with runtime Mnemonica analysis via Chrome Debug Protocol
 * Refactored to expose only 3 bundled tools: execute, list, help
 */
export declare class StrategyServer {
    private server;
    constructor();
    private setupToolHandlers;
    run(): Promise<void>;
}
//# sourceMappingURL=server.d.ts.map