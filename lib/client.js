'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.startStrategyClient = startStrategyClient;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
async function startStrategyClient(options = {}) {
    const scriptPath = (0, node_path_1.join)(__dirname, '../cdp-scripts/ws-server.js');
    const script = (0, node_fs_1.readFileSync)(scriptPath, 'utf-8');
    if (options.port) {
        const globalOpts = global;
        globalOpts.__strategyWSOptions = { port: options.port };
    }
    // The payload is a bare async-IIFE expression; wrap it so the factory
    // returns its promise, then await — same awaitPromise semantics as CDP.
    const factory = new Function(`return (${script});`);
    const bootstrap = await factory();
    if (!bootstrap || !bootstrap.success || typeof bootstrap.port !== 'number' || !bootstrap.token) {
        const failure = (bootstrap && bootstrap.error) || 'ws-server script reported failure';
        throw new Error(`startStrategyClient: ${failure}`);
    }
    const stop = async () => {
        const running = global.__strategyWS;
        if (!running || !running.server) {
            return;
        }
        const closed = new Promise((resolve) => {
            const serverRef = running.server;
            if (serverRef) {
                serverRef.close(() => resolve());
            }
            else {
                resolve();
            }
        });
        await closed;
        running.listening = false;
        delete global.__strategyWS;
    };
    const handle = {
        port: bootstrap.port,
        token: bootstrap.token,
        pid: bootstrap.pid || process.pid,
        alreadyRunning: bootstrap.alreadyRunning === true,
        stop,
    };
    return handle;
}
//# sourceMappingURL=client.js.map