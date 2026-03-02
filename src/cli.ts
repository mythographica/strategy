#!/usr/bin/env node
'use strict';

import { StrategyServer } from './server';

/**
 * CLI entry point for Mnemonica Strategy MCP Server
 */
async function main (): Promise<void> {
	const server = new StrategyServer();
	await server.run();
}

main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
