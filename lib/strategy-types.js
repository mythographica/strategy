'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyRuntime = exports.WSChannel = exports.StrategyConnection = exports.CommandContext = exports.StrategyTypes = void 0;
const mnemonica_1 = require("mnemonica");
// the builder value: root definition on the default collection, exported —
// its registry is local and handler-derived, so the export is the API root
exports.StrategyTypes = mnemonica_1.mnemonica.define('StrategyRuntime', function (version) {
    this.initialized = Date.now();
    this.version = version;
});
// children defined on the root constructor value (paths StrategyRuntime.X);
// exported directly — the builder-rooted registry is local, so these
// define() results name only the public vocabulary and declaration emit
// stays portable on TypeScript 6
exports.CommandContext = exports.StrategyTypes.define('CommandContext', function (requireFn, store, args, runtime) {
    this.require = requireFn;
    this.store = store;
    this.args = args;
    this.runtime = runtime;
});
exports.StrategyConnection = exports.StrategyTypes.define('StrategyConnection', function (host, port) {
    this.host = host;
    this.port = port;
    this.isConnected = false;
    this.connectedAt = Date.now();
    this.connection = null;
});
exports.WSChannel = exports.StrategyTypes.define('WSChannel', function (port, pid, token, session) {
    this.port = port;
    this.pid = pid;
    this.token = token;
    this.connectedAt = Date.now();
    this.session = session;
});
// the root constructor itself, looked up from the builder value
exports.StrategyRuntime = exports.StrategyTypes.lookup('StrategyRuntime');
//# sourceMappingURL=strategy-types.js.map