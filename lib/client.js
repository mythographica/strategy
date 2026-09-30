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
    if (options.port || options.server || options.path || options.role) {
        bag.__strategyWSOptions = {
            port: options.port,
            server: options.server,
            path: options.path,
            role: options.role,
        };
    }
    // The payload is a bare async-IIFE expression; wrap it so the factory
    // returns its promise, then await — same awaitPromise semantics as CDP.
    const factory = new Function('global', 'process', 'Buffer', `return (${script});`);
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
            ? (options.server.address()?.port ?? 0)
            : 0);
    const stop = async () => {
        const running = bag.__strategyWS;
        if (!running) {
            return;
        }
        // Mounted teardown detaches only the upgrade listener; standalone
        // closes the channel's own server. Either way the app is untouched.
        if (typeof running.stop === 'function') {
            running.stop();
        }
        else if (running.server) {
            const closed = new Promise((resolve) => {
                running.server?.close(() => resolve());
            });
            await closed;
        }
        running.listening = false;
        delete bag.__strategyWS;
        delete bag.__strategyWSOptions;
    };
    const handle = {
        port,
        token: bootstrap.token,
        pid: bootstrap.pid || process.pid,
        alreadyRunning: bootstrap.alreadyRunning === true,
        stop,
    };
    return handle;
}
//# sourceMappingURL=client.js.map