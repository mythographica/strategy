'use strict';

import { mnemonica } from 'mnemonica';
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
 *   ├── StrategyConnection — one per attached CDP target, stored as store['cdp']
 *   └── WSChannel          — one per bootstrapped WS channel, stored as store['ws']
 *
 * Command files are plain JS evaluated via `new Function('ctx', ...)`; they
 * only ever destructure props off these instances, which works identically
 * through mnemonica's proxy layer.
 *
 * Typing: builder mode on the default collection. The chain value carries
 * a LOCAL registry derived from the handlers, so it cannot drift; the
 * exported API is the looked-up constructors — never the raw define()
 * results — which keeps declaration emit portable on TypeScript 6
 * (see mnemonica docs/typed-lookup.md, "Declaration emit on TypeScript 6").
 */

export interface StrategyRuntimeInstance {
	initialized        : number;
	version            : string;
	CommandContext     : TypeConstructor<CommandContextInstance>;
	StrategyConnection : TypeConstructor<StrategyConnectionInstance>;
	WSChannel          : TypeConstructor<WSChannelInstance>;
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

export interface WSChannelInstance {
	port        : number;
	pid         : number;
	token       : string;
	connectedAt : number;
	session     : unknown;
}

// the builder value: root definition on the default collection, exported —
// its registry is local and handler-derived, so the export is the API root
export const StrategyTypes = mnemonica.define('StrategyRuntime', function (this: StrategyRuntimeInstance, version: string) {
	this.initialized = Date.now();
	this.version = version;
});

// children defined on the root constructor value (paths StrategyRuntime.X);
// exported directly — the builder-rooted registry is local, so these
// define() results name only the public vocabulary and declaration emit
// stays portable on TypeScript 6
export const CommandContext = StrategyTypes.define('CommandContext', function (
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

export const StrategyConnection = StrategyTypes.define('StrategyConnection', function (
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

export const WSChannel = StrategyTypes.define('WSChannel', function (
	this: WSChannelInstance,
	port: number,
	pid: number,
	token: string,
	session: unknown
) {
	this.port = port;
	this.pid = pid;
	this.token = token;
	this.connectedAt = Date.now();
	this.session = session;
});

// the root constructor itself, looked up from the builder value
export const StrategyRuntime = StrategyTypes.lookup('StrategyRuntime');
