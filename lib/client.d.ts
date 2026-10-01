import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
/** The channel's upgrade handling, for apps that own the upgrade routing. */
export type StrategyUpgradeHandler = (request: IncomingMessage, socket: Duplex) => void;
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
    /**
     * false (mounted mode only): do NOT self-attach to the server's 'upgrade'
     * event. Instead the returned handle carries `upgradeHandler` — pass it
     * to the app's own upgrade decision point (infer-debug's
     * appUpgradeHandler) so relayed and local upgrades never double-claim a
     * socket. Default true: the channel claims its own path, exactly as
     * before.
     */
    attach?: boolean;
}
export interface StrategyClientHandle {
    port: number;
    token: string;
    pid: number;
    alreadyRunning: boolean;
    /** Present when started with attach:false — hand it to the app's upgrade router. */
    upgradeHandler?: StrategyUpgradeHandler;
    stop: () => Promise<void>;
}
export declare function startStrategyClient(options?: StrategyClientOptions): Promise<StrategyClientHandle>;
//# sourceMappingURL=client.d.ts.map