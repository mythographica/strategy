/**
 * MCP Tool Metadata:
 * {
 *   "name": "stop_swagger_api",
 *   "description": "Stop the running Swagger API server",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "excludeFromMCP": true
 * }
 */

// Stop the Swagger API server gracefully
// Uses global.__swaggerApiServer pointer stored by start-swagger-api

try {
	if (global.__swaggerApiServer) {
		var server = global.__swaggerApiServer;
		var port = 'unknown';

		try {
			var addr = server.address();
			if (addr && addr.port) {
				port = addr.port;
			}
		} catch (e) {
			// Ignore address errors
		}

		// Close the server
		server.close(function () {
			process._rawDebug('[Swagger API] Server stopped on port ' + port);
		});

		// Clear the global reference
		delete global.__swaggerApiServer;

		return {
			success: true,
			message: 'Swagger API server stopped successfully',
			port: port,
			status: 'stopped'
		};
	} else {
		return {
			success: false,
			message: 'No Swagger API server is currently running',
			status: 'not_running',
			note: 'Use start_swagger_api to start the server'
		};
	}
} catch (e) {
	return {
		success: false,
		error: e.message,
		stack: e.stack
	};
}
