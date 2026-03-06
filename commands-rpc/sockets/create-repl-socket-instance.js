/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_repl_socket_instance",
 *   "description": "Create and start REPLSocketServer instance for Unix domain socket access",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "socketPath": {
 *         "type": "string",
 *         "description": "Path for Unix domain socket"
 *       }
 *     }
 *   },
 *   "excludeFromMCP": true
 * }
 */

// Create an instance of REPLSocketServer and start it

(() => {
	// Get ctx from the execution context
	var ctx = (typeof ctx !== 'undefined') ? ctx : {};
	var require = ctx.require || function(m) { return require(m); };
	var args = ctx.args || {};

	// Parse message if it exists
	if (args.message && typeof args.message === 'string') {
		try {
			var parsed = JSON.parse(args.message);
			args = parsed;
		} catch (e) {
			// keep original args
		}
	}

	try {
		// Get args
		var socketPath = args.socketPath || '/tmp/mnemonica-repl.sock';

		// Get mnemonica from global scope or via require
		var mnemonica = global.mnemonica || require('mnemonica');
		var defaultTypes = mnemonica.defaultTypes;

		// First, ensure REPLSocketServer type exists
		var REPLSocketServer = defaultTypes.REPLSocketServer;

		if (!REPLSocketServer) {
			return {
				success: false,
				error: 'REPLSocketServer type not found. Run create-repl-socket-type first.',
				suggestion: 'Use dynamic_tool with create-repl-socket-type command'
			};
		}

		// Create server instance
		var serverInstance = new REPLSocketServer({
			socketPath: socketPath
		});

		// Start the server with NestJS app context
		var startResult = serverInstance.start({
			help: function () {
				return 'Mnemonica REPL Commands:\n' +
					'  .types  - List all Mnemonica types\n' +
					'  .stats  - Show server statistics\n' +
					'  .exit   - Close REPL session';
			}
		});

		// Store in global for access
		if (!global.__mnemonicaReplServer) {
			global.__mnemonicaReplServer = serverInstance;
		}

		return {
			success: true,
			message: 'REPL Socket Server started (Unix domain socket)',
			server: {
				socketPath: socketPath,
				status: 'starting',
				pid: process.pid
			},
			usage: {
				connect: 'nc -U ' + socketPath,
				orSocat: 'socat - UNIX-CONNECT:' + socketPath
			},
			replCommands: ['.types', '.stats', '.exit'],
			context: {
				available: ['mnemonica', 'define', 'defaultTypes', 'console', 'help']
			}
		};

	} catch (error) {
		return {
			success: false,
			error: error.message,
			stack: error.stack
		};
	}
})();
