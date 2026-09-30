import type { Server as HttpServer } from 'node:http';
export interface StrategyClientOptions {
    /** Fixed port for the channel; 0 or omitted = ephemeral (default). */
    port?: number;
    /**
     * An EXISTING http.Server to mount the channel on (target architecture:
     * one pod, one port). No own listener is opened; the channel answers WS
     * upgrades on `path` of this server. The app stays the owner — `stop()`
     * only detaches the upgrade listener.
     */
    server?: HttpServer;
    /** Upgrade path for the mounted channel (default '/strategy'). */
    path?: string;
    /**
     * 'observer' — traces only: every write op (eval/patch/rollback/swap/
     * define/instantiate) is refused with a readable error. 'debug' — hot-swap
     * tools only (patch/rollback/patched/eval): trace ops refused. Omit for
     * the full surface.
     */
    role?: 'observer' | 'debug';
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