'use strict';

import WebSocket from 'ws';

/**
 * Strategy-side client for the in-target WS construction channel.
 *
 * The server half is `cdp-scripts/ws-server.js`, injected into the target
 * via one CDP `Runtime.evaluate`. This client speaks to it from the MCP
 * process: one JSON message per WS frame, `{ id, op, params }` out,
 * `{ id, ok, result | error }` back. Auth is at handshake time — the
 * session token rides the `?token=` query of the upgrade request.
 */

interface PendingRequest {
	resolve: (value: unknown) => void;
	reject: (err: Error) => void;
	timer: ReturnType<typeof setTimeout>;
}

export interface WelcomeMessage {
	op: 'welcome';
	protocol: number;
	pid: number;
	mnemonica: string | null;
	rootTypes: string[];
}

const DEFAULT_TIMEOUT_MS = 30_000;

export class WSSession {
	private socket: WebSocket;
	private nextId = 1;
	private pending = new Map<number, PendingRequest>();
	private closed = false;

	/**
	 * The server's welcome frame, if it arrived. Carries the target's
	 * protocol version, pid, mnemonica version and root type names.
	 */
	welcome: WelcomeMessage | null = null;

	private constructor (socket: WebSocket) {
		this.socket = socket;
		socket.on('message', (data: WebSocket.RawData) => {
			this.onMessage(data);
		});
		socket.on('close', () => {
			this.onClose();
		});
		// 'error' is always followed by 'close' in ws — cleanup lives there
		socket.on('error', () => {});
	}

	static async connect (host: string, port: number, token: string): Promise<WSSession> {
		const url = `ws://${host}:${port}/?token=${token}`;
		const socket = new WebSocket(url, {
			// the in-target server caps messages at 16 MiB; match it here
			maxPayload: 16 * 1024 * 1024,
		});
		await new Promise<void>((resolve, reject) => {
			socket.once('open', () => resolve());
			socket.once('error', (err: Error) => reject(err));
		});
		const session = new WSSession(socket);
		return session;
	}

	get isOpen (): boolean {
		const open = !this.closed && this.socket.readyState === WebSocket.OPEN;
		return open;
	}

	async request (
		op: string,
		params: Record<string, unknown> = {},
		timeoutMs: number = DEFAULT_TIMEOUT_MS
	): Promise<unknown> {
		if (this.closed) {
			throw new Error('WS session is closed — re-run ws_bootstrap');
		}
		const id = this.nextId++;
		const response = new Promise<unknown>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`ws request "${op}" timed out after ${timeoutMs}ms`));
			}, timeoutMs);
			this.pending.set(id, { resolve, reject, timer });
		});
		this.socket.send(JSON.stringify({ id, op, params }));
		const result = await response;
		return result;
	}

	close (): void {
		if (this.closed) {
			return;
		}
		this.closed = true;
		try {
			this.socket.close();
		} catch {
			// already gone
		}
		this.onClose();
	}

	private onMessage (data: WebSocket.RawData): void {
		let msg: {
			id?: number | null;
			ok?: boolean;
			result?: unknown;
			error?: { message?: string; stack?: string | null };
			op?: string;
		};
		try {
			msg = JSON.parse(String(data)) as typeof msg;
		} catch {
			return;
		}

		if (msg.op === 'welcome') {
			this.welcome = msg as unknown as WelcomeMessage;
			return;
		}

		if (typeof msg.id !== 'number') {
			return;
		}
		const entry = this.pending.get(msg.id);
		if (!entry) {
			return;
		}
		this.pending.delete(msg.id);
		clearTimeout(entry.timer);

		if (msg.ok) {
			entry.resolve(msg.result);
		} else {
			const message = msg.error?.message || 'unknown in-target error';
			const err = new Error(message);
			if (msg.error?.stack) {
				err.stack = msg.error.stack;
			}
			entry.reject(err);
		}
	}

	private onClose (): void {
		this.closed = true;
		for (const entry of this.pending.values()) {
			clearTimeout(entry.timer);
			entry.reject(new Error('WS connection to target closed'));
		}
		this.pending.clear();
	}
}
