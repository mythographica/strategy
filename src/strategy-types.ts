'use strict';

import { define } from 'mnemonica';
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
	initialized        : number;
	version            : string;
	CommandContext     : TypeConstructor<CommandContextInstance>;
	StrategyConnection : TypeConstructor<StrategyConnectionInstance>;
}

export interface CommandContextInstance {
	require : NodeJS.Require;
	store   : Map<string | symbol, unknown>;
	args    : unknown;
	runtime : StrategyRuntimeInstance;
}

export interface StrategyConnectionInstance {
	host        : string;
	port        : number;
	isConnected : boolean;
	connectedAt : number;
	connection  : unknown;
}

export const StrategyRuntime = define('StrategyRuntime', function (this: StrategyRuntimeInstance, version: string) {
	this.initialized = Date.now();
	this.version = version;
});

export const CommandContext = StrategyRuntime.define('CommandContext', function (
	this: CommandContextInstance,
	requireFn: NodeJS.Require,
	store: Map<string | symbol, unknown>,
	args: unknown,
	runtime: StrategyRuntimeInstance
) {
	this.require = requireFn;
	this.store = store;
	this.args = args;
	this.runtime = runtime;
});

export const StrategyConnection = StrategyRuntime.define('StrategyConnection', function (
	this: StrategyConnectionInstance,
	host: string,
	port: number
) {
	this.host = host;
	this.port = port;
	this.isConnected = false;
	this.connectedAt = Date.now();
	this.connection = null;
});
