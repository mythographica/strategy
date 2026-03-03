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
 *   }
 * }
 */

// Create an instance of REPLSocketServer and start it

(() => {
	try {
		// Get args
		var socketPath = (typeof _toolArgs !== 'undefined' && _toolArgs.socketPath) ? _toolArgs.socketPath : '/tmp/mnemonica-repl.sock';

		// Get mnemonica from global scope
		var mnemonica = global.mnemonica || process.mainModule.require('mnemonica');
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
