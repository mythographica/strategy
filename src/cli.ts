#!/usr/bin/env node
'use strict';

import { StrategyServer } from './server';
import { logError } from './logger';

/**
 * CLI entry point for Mnemonica Strategy MCP Server
 */
async function main (): Promise<void> {
	const server = new StrategyServer();
	await server.run();
}

main().catch((error) => {
	logError('Fatal error:', error);
	process.exit(1);
});
