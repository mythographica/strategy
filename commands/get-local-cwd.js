/**
 * MCP Tool Metadata:
 * {
 *   "name": "get_local_cwd",
 *   "description": "Get the current working directory from the MCP server process (local execution)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

// This command runs locally in the MCP server process
// It exports a run() function for local execution

function run () {
	const cwd = process.cwd();
	const argv = process.argv;
	const pid = process.pid;
	const platform = process.platform;
	const version = process.version;
	
	return {
		location: 'MCP Server Process (Local)',
		cwd: cwd,
		pid: pid,
		platform: platform,
		version: version,
		argv0: argv[0],
		script: argv[1],
	};
}

module.exports = { run };
