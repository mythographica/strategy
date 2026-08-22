'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyConnection = exports.CommandContext = exports.StrategyRuntime = void 0;
const mnemonica_1 = require("mnemonica");
exports.StrategyRuntime = (0, mnemonica_1.define)('StrategyRuntime', function (version) {
    this.initialized = Date.now();
    this.version = version;
});
exports.CommandContext = exports.StrategyRuntime.define('CommandContext', function (requireFn, store, args, runtime) {
    this.require = requireFn;
    this.store = store;
    this.args = args;
    this.runtime = runtime;
});
exports.StrategyConnection = exports.StrategyRuntime.define('StrategyConnection', function (host, port) {
    this.host = host;
    this.port = port;
    this.isConnected = false;
    this.connectedAt = Date.now();
    this.connection = null;
});
//# sourceMappingURL=strategy-types.js.map