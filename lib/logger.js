'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.setLogBroadcast = setLogBroadcast;
exports.logInfo = logInfo;
exports.logError = logError;
const node_util_1 = require("node:util");
/**
 * Strategy's log tee.
 *
 * Lines ALWAYS go to stderr — stdout is the MCP protocol channel and must
 * stay protocol-clean. When the log socket is up (see log-socket.ts) every
 * line is additionally broadcast to the connected socket clients, so whoever
 * spawned the server (Mnemographica, a human, an agent) can watch the logs
 * without touching the protocol stream.
 */
let broadcast = () => { };
function setLogBroadcast(fn) {
    broadcast = fn;
}
function emit(level, args) {
    const line = `[${level}] ${(0, node_util_1.format)(...args)}`;
    console.error(line);
    broadcast(line);
}
function logInfo(...args) {
    emit('info', args);
}
function logError(...args) {
    emit('error', args);
}
//# sourceMappingURL=logger.js.map