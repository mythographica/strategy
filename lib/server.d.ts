/**
 * Strategy MCP Server
 * Provides AI agents with runtime Mnemonica analysis via Chrome Debug Protocol
 */
export declare class StrategyServer {
    private server;
    private cdpConnection;
    private tacticaComparison;
    constructor();
    private setupToolHandlers;
    run(): Promise<void>;
}
//# sourceMappingURL=server.d.ts.map