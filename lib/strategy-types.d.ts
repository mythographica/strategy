import type { TypeConstructor } from 'mnemonica';
/**
 * Strategy's own architecture, defined as mnemonica types.
 *
 * StrategyRuntime is the root node: exactly one instance lives in the
 * server's global store under StoreMeta for the process lifetime.
 * Subtypes are constructed from that instance (`new runtime.CommandContext(...)`),
 * so the server's live state forms a real mnemonica tree:
 *
 *   StrategyRuntime
 *   ├── CommandContext     — one per execute() call, handed to commands as `ctx`
 *   └── StrategyConnection — one per attached CDP target, stored as store['cdp']
 *
 * Command files are plain JS evaluated via `new Function('ctx', ...)`; they
 * only ever destructure props off these instances, which works identically
 * through mnemonica's proxy layer.
 */
export interface StrategyRuntimeInstance {
    initialized: number;
    version: string;
    CommandContext: TypeConstructor<CommandContextInstance>;
    StrategyConnection: TypeConstructor<StrategyConnectionInstance>;
}
export interface CommandContextInstance {
    require: NodeJS.Require;
    store: Map<string | symbol, unknown>;
    args: unknown;
    runtime: StrategyRuntimeInstance;
}
export interface StrategyConnectionInstance {
    host: string;
    port: number;
    isConnected: boolean;
    connectedAt: number;
    connection: unknown;
}
export declare const StrategyRuntime: import("mnemonica").IDefinitorInstance<StrategyRuntimeInstance, import("mnemonica").InstanceResult<StrategyRuntimeInstance>, import("mnemonica/build/types").GlobalRegistry, "">;
export declare const CommandContext: import("mnemonica").IDefinitorInstance<CommandContextInstance & Pick<StrategyRuntimeInstance, keyof StrategyRuntimeInstance>, import("mnemonica").InstanceResult<CommandContextInstance & Pick<StrategyRuntimeInstance, keyof StrategyRuntimeInstance>>, import("mnemonica").TypeRegistry & Record<string, import("mnemonica").TypeConstructorBase> & Record<"CommandContext", import("mnemonica/build/types").StoredConstructor<CommandContextInstance & Pick<StrategyRuntimeInstance, keyof StrategyRuntimeInstance>, "CommandContext">>, "CommandContext">;
export declare const StrategyConnection: import("mnemonica").IDefinitorInstance<StrategyConnectionInstance & Pick<StrategyRuntimeInstance, keyof StrategyRuntimeInstance>, import("mnemonica").InstanceResult<StrategyConnectionInstance & Pick<StrategyRuntimeInstance, keyof StrategyRuntimeInstance>>, import("mnemonica").TypeRegistry & Record<string, import("mnemonica").TypeConstructorBase> & Record<"StrategyConnection", import("mnemonica/build/types").StoredConstructor<StrategyConnectionInstance & Pick<StrategyRuntimeInstance, keyof StrategyRuntimeInstance>, "StrategyConnection">>, "StrategyConnection">;
//# sourceMappingURL=strategy-types.d.ts.map