/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_http_server_type",
 *   "description": "Create a Mnemonica type that starts an HTTP server for Chrome DevTools discovery",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "excludeFromMCP": true
 * }
 */

// This script creates a type that starts an HTTP server on port 9228
// Chrome DevTools can discover this as a "debug target"

(() => {
	try {
		var mnemonica = process.mainModule.require('mnemonica');

		// Get SyncBase as parent using lookup
		var SyncBase = mnemonica.defaultTypes.lookup('SyncBase');

		if (!SyncBase) {
			process._rawDebug('[create-http-server-type] ERROR: SyncBase not found');
			return {
				error: 'SyncBase not found'
			};
		}

		process._rawDebug('[create-http-server-type] Found SyncBase, creating HTTPServer type...');

		// Create HTTPServer type
		var HTTPServerType = SyncBase.define('HTTPServer', function (data) {
			process._rawDebug('[HTTPServer constructor] Starting HTTP server on port 9228...');

			var http = process.mainModule.require('http');

			// Create HTTP server that responds with debug info
			var server = http.createServer(function (req, res) {
				process._rawDebug('[HTTPServer] Request: ' + req.url);

				// Chrome DevTools expects JSON at /json/list
				if (req.url === '/json/list' || req.url === '/json') {
					res.writeHead(200, { 'Content-Type': 'application/json' });
					res.end(JSON.stringify([{
						id: 'mnemonica-instance-' + Date.now(),
						title: 'Mnemonica HTTPServer Instance',
						type: 'node',
						webSocketDebuggerUrl: 'ws://localhost:9228',
						devtoolsFrontendUrl: 'chrome-devtools://devtools/bundled/js_app.html?ws=localhost:9228'
					}]));
					return;
				}

				// Root path - show status
				res.writeHead(200, { 'Content-Type': 'text/plain' });
				res.end('Mnemonica HTTPServer running on port 9228\nStatus: active\nCreated: ' + new Date().toISOString());
			});

			// Start listening on port 9228
			server.listen(9228, '0.0.0.0', function () {
				process._rawDebug('[HTTPServer] Server listening on http://0.0.0.0:9228');
			});

			this.port = 9228;
			this.status = 'http_server_running';
			this.startedAt = new Date().toISOString();
			this.server = server;

			process._rawDebug('[HTTPServer constructor] Server created successfully');
		});

		process._rawDebug('[create-http-server-type] HTTPServer type created successfully');

		return {
			success: true,
			message: 'HTTPServer type created under SyncBase',
			typeName: 'HTTPServer',
			parentType: 'SyncBase',
			fullPath: 'SyncBase.HTTPServer',
			nextStep: 'Create an instance using create-http-server-instance command'
		};
	} catch (error) {
		process._rawDebug('[create-http-server-type] ERROR: ' + error.message);
		return {
			error: error.message,
			stack: error.stack
		};
	}
})();
