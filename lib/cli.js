#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./server");
const logger_1 = require("./logger");
/**
 * CLI entry point for Mnemonica Strategy MCP Server
 */
async function main() {
    const server = new server_1.StrategyServer();
    await server.run();
}
main().catch((error) => {
    (0, logger_1.logError)('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map