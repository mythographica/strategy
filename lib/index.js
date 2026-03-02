'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.TacticaComparison = exports.CDPConnection = exports.StrategyServer = void 0;
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
// CLI entry point
if (require.main === module) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('./cli');
}
//# sourceMappingURL=index.js.map