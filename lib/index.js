'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.startStrategyClient = exports.WSSession = exports.StrategyConnection = exports.CommandContext = exports.StrategyRuntime = exports.TacticaComparison = exports.CDPConnection = exports.StrategyServer = void 0;
/**
 * @mnemonica/strategy - MCP Server for Mnemonica
 * Provides AI agents with runtime access to type graphs via Chrome Debug Protocol
 */
var server_1 = require("./server");
Object.defineProperty(exports, "StrategyServer", { enumerable: true, get: function () { return server_1.StrategyServer; } });
var cdp_connection_1 = require("./cdp-connection");
Object.defineProperty(exports, "CDPConnection", { enumerable: true, get: function () { return cdp_connection_1.CDPConnection; } });
var tactica_comparison_1 = require("./tactica-comparison");
Object.defineProperty(exports, "TacticaComparison", { enumerable: true, get: function () { return tactica_comparison_1.TacticaComparison; } });
var strategy_types_1 = require("./strategy-types");
Object.defineProperty(exports, "StrategyRuntime", { enumerable: true, get: function () { return strategy_types_1.StrategyRuntime; } });
Object.defineProperty(exports, "CommandContext", { enumerable: true, get: function () { return strategy_types_1.CommandContext; } });
Object.defineProperty(exports, "StrategyConnection", { enumerable: true, get: function () { return strategy_types_1.StrategyConnection; } });
var ws_session_1 = require("./ws-session");
Object.defineProperty(exports, "WSSession", { enumerable: true, get: function () { return ws_session_1.WSSession; } });
var client_1 = require("./client");
Object.defineProperty(exports, "startStrategyClient", { enumerable: true, get: function () { return client_1.startStrategyClient; } });
// CLI entry point
if (require.main === module) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('./cli');
}
//# sourceMappingURL=index.js.map