'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.startLogSocket = startLogSocket;
exports.stopLogSocket = stopLogSocket;
const node_net_1 = require("node:net");
const logger_1 = require("./logger");
/**
 * TCP log mirror (2026-09-01, Strategy reframe).
 *
 * When Strategy is spawned as a child (by Mnemographica or any MCP client),
 * its stderr may not be surfaced anywhere useful. With STRATEGY_LOG_PORT set
 * the server also listens on that TCP port: every client that connects
 * receives every subsequent log line, one per \n. Dumb on purpose — netcat
 * is a valid consumer.
 */
let server = null;
const clients = new Set();
function startLogSocket(port) {
    if (server) {
        const address = server.address();
        const running = typeof address === 'object' && address !== null ? address.port : port;
        const result = Promise.resolve(running);
        return result;
    }
    const started = new Promise((resolve, reject) => {
        const created = (0, node_net_1.createServer)((socket) => {
            clients.add(socket);
            socket.on('error', () => { });
            socket.on('close', () => {
                clients.delete(socket);
            });
        });
        created.once('error', reject);
        created.listen(port, '127.0.0.1', () => {
            server = created;
            const address = created.address();
            const actual = typeof address === 'object' && address !== null ? address.port : port;
            resolve(actual);
        });
    });
    (0, logger_1.setLogBroadcast)((line) => {
        for (const socket of clients) {
            try {
                socket.write(line + '\n');
            }
            catch {
                clients.delete(socket);
            }
        }
    });
    return started;
}
function stopLogSocket() {
    for (const socket of clients) {
        try {
            socket.destroy();
        }
        catch {
            // already gone
        }
    }
    clients.clear();
    if (server) {
        server.close();
        server = null;
    }
    (0, logger_1.setLogBroadcast)(() => { });
}
//# sourceMappingURL=log-socket.js.map