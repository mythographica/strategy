#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./server");
/**
 * CLI entry point for Mnemonica Strategy MCP Server
 */
async function main() {
    const server = new server_1.StrategyServer();
    await server.run();
}
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map