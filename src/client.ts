'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import type { AddressInfo } from 'node:net';

/** The channel's upgrade handling, for apps that own the upgrade routing. */
export type StrategyUpgradeHandler = (request: IncomingMessage, socket: Duplex) => void;

/**
 * The app-side Strategy client.
 *
 * One call — `startStrategyClient()` — self-hosts the WS construction/trace
 * channel INSIDE the calling application. No CDP, no --inspect, nothing
 * injected from outside: the app starts the same server that ws_bootstrap
 * would otherwise push over the debug protocol. This is the `.start()`
 * entrypoint for the "app owns the switch" topology: the channel can come up
 * with the app (config option at start), or later on demand.
 *
 * Single source of truth: the exact `cdp-scripts/ws-server.js` payload is
 * evaluated in-process — the CDP path and the self-hosted path can never
 * diverge. The returned handle carries { port, token }: the app decides how
 * to publish them (log line, control endpoint, env of a sidecar) so a
 * monitor (Mnemographica) can connect directly with `WSSession.connect`.
 */

interface WsServerBootstrapResult {
	success: boolean;
	alreadyRunning?: boolean;
	port?: number;
	token?: string;
	pid?: number;
	upgradeHandler?: unknown;
	error?: string;
	stack?: string;
}

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

interface StrategyWSGlobal {
	__strategyWS?: {
		listening: boolean;
		server?: { close: (cb: () => void) => void };
		port: number;
		token: string;
		stop?: () => void;
	};
	__strategyWSOptions?: {
		port?: number;
		server?: HttpServer;
		path?: string;
		role?: 'observer' | 'debug';
		attach?: boolean;
	};
}

export async function startStrategyClient (
	options: StrategyClientOptions = {}
): Promise<StrategyClientHandle> {
	const scriptPath = join(__dirname, '../cdp-scripts/ws-server.js');
	const script = readFileSync(scriptPath, 'utf-8');

	// The payload's free identifiers (global/process/Buffer) normally resolve
	// against the global object AT EVERY USE — including its async
	// continuations (the server.listen callback, per-connection handlers).
	// That breaks in an Electron renderer preload (sandbox:false): Electron
	// deletes Node's globals from the main world the moment the preload's
	// synchronous phase ends, and the payload dies later with
	// "global is not defined". Capture the Node globals HERE, at call time,
	// and bind them as factory PARAMETERS — async continuations then read
	// parameters, not the (possibly stripped) global object. In plain Node
	// this binds the very objects the payload would have found anyway.
	const nodeGlobal = typeof global !== 'undefined' ? global : (globalThis as typeof global);
	const nodeProcess = typeof process !== 'undefined' ? process : undefined;
	const nodeBuffer = typeof Buffer !== 'undefined' ? Buffer : undefined;
	const bag = nodeGlobal as unknown as StrategyWSGlobal;

	if (options.port || options.server || options.path || options.role || options.attach === false) {
		bag.__strategyWSOptions = {
			port   : options.port,
			server : options.server,
			path   : options.path,
			role   : options.role,
			attach : options.attach,
		};
	}

	// The payload is a bare async-IIFE expression; wrap it so the factory
	// returns its promise, then await — same awaitPromise semantics as CDP.
	const factory = new Function(
		'global', 'process', 'Buffer',
		`return (${script});`
	) as (g: unknown, p: unknown, b: unknown) => Promise<WsServerBootstrapResult>;
	const bootstrap = await factory(nodeGlobal, nodeProcess, nodeBuffer);
	if (!bootstrap || !bootstrap.success || !bootstrap.token) {
		const failure = (bootstrap && bootstrap.error) || 'ws-server script reported failure';
		throw new Error(`startStrategyClient: ${failure}`);
	}
	// Standalone always has a number; mounted may report null when the app
	// server is not listening yet — resolve it from the server, else 0.
	const port = typeof bootstrap.port === 'number'
		? bootstrap.port
		: (options.server
			? ((options.server.address() as AddressInfo | null)?.port ?? 0)
			: 0);

	const stop = async (): Promise<void> => {
		const running = bag.__strategyWS;
		if (!running) {
			return;
		}
		// Mounted teardown detaches only the upgrade listener; standalone
		// closes the channel's own server. Either way the app is untouched.
		if (typeof running.stop === 'function') {
			running.stop();
		} else if (running.server) {
			const closed = new Promise<void>((resolve) => {
				running.server?.close(() => resolve());
			});
			await closed;
		}
		running.listening = false;
		delete bag.__strategyWS;
		delete bag.__strategyWSOptions;
	};

	const handle: StrategyClientHandle = {
		port,
		token          : bootstrap.token,
		pid            : bootstrap.pid || process.pid,
		alreadyRunning : bootstrap.alreadyRunning === true,
		upgradeHandler : typeof bootstrap.upgradeHandler === 'function'
			? bootstrap.upgradeHandler as StrategyUpgradeHandler
			: undefined,
		stop,
	};
	return handle;
}
