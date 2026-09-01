'use strict';

import { format } from 'node:util';

/**
 * Strategy's log tee.
 *
 * Lines ALWAYS go to stderr — stdout is the MCP protocol channel and must
 * stay protocol-clean. When the log socket is up (see log-socket.ts) every
 * line is additionally broadcast to the connected socket clients, so whoever
 * spawned the server (Mnemographica, a human, an agent) can watch the logs
 * without touching the protocol stream.
 */

let broadcast: (line: string) => void = () => {};

export function setLogBroadcast (fn: (line: string) => void): void {
	broadcast = fn;
}

function emit (level: string, args: unknown[]): void {
	const line = `[${level}] ${format(...args)}`;
	console.error(line);
	broadcast(line);
}

export function logInfo (...args: unknown[]): void {
	emit('info', args);
}

export function logError (...args: unknown[]): void {
	emit('error', args);
}
