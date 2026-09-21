'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.startStrategyClient = startStrategyClient;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
async function startStrategyClient(options = {}) {
    const scriptPath = (0, node_path_1.join)(__dirname, '../cdp-scripts/ws-server.js');
    const script = (0, node_fs_1.readFileSync)(scriptPath, 'utf-8');
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
    const nodeGlobal = typeof global !== 'undefined' ? global : globalThis;
    const nodeProcess = typeof process !== 'undefined' ? process : undefined;
    const nodeBuffer = typeof Buffer !== 'undefined' ? Buffer : undefined;
    const bag = nodeGlobal;
    if (options.port) {
        bag.__strategyWSOptions = { port: options.port };
    }
    // The payload is a bare async-IIFE expression; wrap it so the factory
    // returns its promise, then await — same awaitPromise semantics as CDP.
    const factory = new Function('global', 'process', 'Buffer', `return (${script});`);
    const bootstrap = await factory(nodeGlobal, nodeProcess, nodeBuffer);
    if (!bootstrap || !bootstrap.success || typeof bootstrap.port !== 'number' || !bootstrap.token) {
        const failure = (bootstrap && bootstrap.error) || 'ws-server script reported failure';
        throw new Error(`startStrategyClient: ${failure}`);
    }
    const stop = async () => {
        const running = bag.__strategyWS;
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
        delete bag.__strategyWS;
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