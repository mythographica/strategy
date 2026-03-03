/**
 * MCP Tool Metadata:
 * {
 *   "name": "open_inspector_9009",
 *   "description": "Get instructions for debugging Strategy MCP on port 9009",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

// Get instructions for debugging the Strategy MCP server on port 9009
// NOTE: Due to Node.js inspector singleton limitation, the inspector must be
// started when the MCP server launches, not dynamically via this command.

module.exports.run = function () {
	return {
		info: 'Node.js Inspector Setup for Strategy MCP',
		explanation: 'Node.js inspector is a singleton - it cannot be opened dynamically via MCP commands',
		limitation: 'The inspector must be started when the MCP server process launches',
		solution: {
			step1: 'Stop the MCP server',
			step2: 'Restart with inspector enabled: node --inspect=9009 build/index.js',
			step3: 'Or set NODE_OPTIONS=--inspect=9009 before starting'
		},
		usage: {
			chrome: 'Open chrome://inspect and click "Open dedicated DevTools for Node"',
			cli: 'node inspect localhost:9009',
			vscode: 'Use "Attach to Node Process" configuration with port 9009'
		},
		note: 'Once connected, you can debug the MCP server itself, set breakpoints, inspect variables, etc.'
	};
};
