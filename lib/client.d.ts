export interface StrategyClientOptions {
    /** Fixed port for the channel; 0 or omitted = ephemeral (default). */
    port?: number;
}
export interface StrategyClientHandle {
    port: number;
    token: string;
    pid: number;
    alreadyRunning: boolean;
    stop: () => Promise<void>;
}
export declare function startStrategyClient(options?: StrategyClientOptions): Promise<StrategyClientHandle>;
//# sourceMappingURL=client.d.ts.map