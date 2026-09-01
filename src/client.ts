'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The app-side Strategy client (2026-09-01, Strategy reframe).
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
	error?: string;
	stack?: string;
}

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

interface StrategyWSGlobal {
	__strategyWS?: {
		listening: boolean;
		server?: { close: (cb: () => void) => void };
		port: number;
		token: string;
	};
	__strategyWSOptions?: { port?: number };
}

export async function startStrategyClient (
	options: StrategyClientOptions = {}
): Promise<StrategyClientHandle> {
	const scriptPath = join(__dirname, '../cdp-scripts/ws-server.js');
	const script = readFileSync(scriptPath, 'utf-8');

	if (options.port) {
		const globalOpts = global as unknown as StrategyWSGlobal;
		globalOpts.__strategyWSOptions = { port: options.port };
	}

	// The payload is a bare async-IIFE expression; wrap it so the factory
	// returns its promise, then await — same awaitPromise semantics as CDP.
	const factory = new Function(`return (${script});`) as () => Promise<WsServerBootstrapResult>;
	const bootstrap = await factory();
	if (!bootstrap || !bootstrap.success || typeof bootstrap.port !== 'number' || !bootstrap.token) {
		const failure = (bootstrap && bootstrap.error) || 'ws-server script reported failure';
		throw new Error(`startStrategyClient: ${failure}`);
	}

	const stop = async (): Promise<void> => {
		const running = (global as unknown as StrategyWSGlobal).__strategyWS;
		if (!running || !running.server) {
			return;
		}
		const closed = new Promise<void>((resolve) => {
			const serverRef = running.server;
			if (serverRef) {
				serverRef.close(() => resolve());
			} else {
				resolve();
			}
		});
		await closed;
		running.listening = false;
		delete (global as unknown as StrategyWSGlobal).__strategyWS;
	};

	const handle: StrategyClientHandle = {
		port           : bootstrap.port,
		token          : bootstrap.token,
		pid            : bootstrap.pid || process.pid,
		alreadyRunning : bootstrap.alreadyRunning === true,
		stop,
	};
	return handle;
}
