'use strict';

/**
 * @mnemonica/strategy - MCP Server for Mnemonica
 * Provides AI agents with runtime access to type graphs via Chrome Debug Protocol
 */

export { StrategyServer } from './server';
export { CDPConnection } from './cdp-connection';
export { TacticaComparison } from './tactica-comparison';

// CLI entry point
if (require.main === module) {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	require('./cli');
}
