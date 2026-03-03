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