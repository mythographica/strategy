/**
 * MCP Tool Metadata:
 * {
 *   "name": "connection",
 *   "description": "Manage CDP connection to Node.js runtime (connect, disconnect, status, evaluate)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "action": {
 *         "type": "string",
 *         "enum": ["connect", "disconnect", "status", "evaluate"],
 *         "description": "Connection action to perform"
 *       },
 *       "host": {
 *         "type": "string",
 *         "description": "Host to connect to (default: localhost)"
 *       },
 *       "port": {
 *         "type": "number",
 *         "description": "Port to connect to (default: 9229)"
 *       },
 *       "code": {
 *         "type": "string",
 *         "description": "JavaScript code to evaluate (for action: evaluate)"
 *       }
 *     }
 *   },
 *   "examples": [
 *     {
 *       "description": "Connect to default runtime",
 *       "args": { "action": "connect" }
 *     },
 *     {
 *       "description": "Evaluate code in remote runtime",
 *       "args": { "action": "evaluate", "code": "1 + 1" }
 *     }
 *   ]
 * }
 */

// Manage CDP connection to Node.js runtime
// Stores connection in global.StrategyMCP for use by other commands

// Initialize shared StrategyMCP state
var StrategyMCP = global.StrategyMCP || (function () {
	global.StrategyMCP = {
		store: new Map(),
		cdp: {
			connection: null,
			isConnected: false,
			host: null,
			port: null,
			lastUsed: null
		},
		resources: {
			servers: new Map(),
			sockets: new Map()
		},
		utils: {
			get: function (k) { return global.StrategyMCP.store.get(k); },
			set: function (k, v) { return global.StrategyMCP.store.set(k, v); },
			getCDP: function () {
				var cdp = global.StrategyMCP.cdp;
				if (!cdp.isConnected) throw new Error('CDP not connected');
				cdp.lastUsed = Date.now();
				return cdp.connection;
			},
			isCDPConnected: function () {
				return global.StrategyMCP.cdp.isConnected;
			},
			setCDP: function (ws, host, port) {
				var cdp = global.StrategyMCP.cdp;
				cdp.connection = ws;
				cdp.isConnected = true;
				cdp.host = host;
				cdp.port = port;
				cdp.lastUsed = Date.now();
			},
			clearCDP: function () {
				var cdp = global.StrategyMCP.cdp;
				if (cdp.connection) {
					try { cdp.connection.close(); } catch (e) {}
				}
				cdp.connection = null;
				cdp.isConnected = false;
				cdp.host = null;
				cdp.port = null;
				cdp.lastUsed = null;
			}
		}
	};
	return global.StrategyMCP;
})();

try {
	var args = (typeof _toolArgs !== 'undefined') ? _toolArgs : {};
	var action = args.action || 'status';

	if (action === 'connect') {
		var host = args.host || 'localhost';
		var port = args.port || 9229;

		// Check if already connected to same host/port
		var cdp = StrategyMCP.cdp;
		if (cdp.isConnected && cdp.host === host && cdp.port === port) {
			return {
				success: true,
				action: 'connect',
				message: 'Already connected to ' + host + ':' + port,
				reused: true,
				host: host,
				port: port
			};
		}

		// Close existing connection if different
		if (cdp.isConnected) {
			StrategyMCP.utils.clearCDP();
		}

		// Check if ws module is available
		try {
			var WebSocket = process.mainModule.require('ws');
		} catch (e) {
			return {
				success: false,
				error: 'WebSocket module (ws) not available. Install with: npm install ws',
				solution: 'Run "npm install ws" in the strategy directory'
			};
		}

		// Try to connect to CDP
		var http = process.mainModule.require('http');
		var jsonUrl = 'http://' + host + ':' + port + '/json';

		// Make HTTP request to get WebSocket URL
		var req = http.get(jsonUrl, function (res) {
			var data = '';
			res.on('data', function (chunk) { data += chunk; });
			res.on('end', function () {
				try {
					var targets = JSON.parse(data);
					if (!targets.length) {
						process._rawDebug('[CDP] No debug targets available');
						return;
					}

					var wsUrl = targets[0].webSocketDebuggerUrl;
					var ws = new WebSocket(wsUrl);

					ws.on('open', function () {
						StrategyMCP.utils.setCDP(ws, host, port);
						StrategyMCP.cdp.url = wsUrl;
						StrategyMCP.cdp.target = targets[0].title;
						StrategyMCP.cdp.messageId = 0;
						StrategyMCP.cdp.pending = new Map();
						process._rawDebug('[CDP] Connected to ' + host + ':' + port);
					});

					ws.on('message', function (data) {
						var msg = JSON.parse(data);
						var pending = StrategyMCP.cdp.pending;
						if (msg.id && pending.has(msg.id)) {
							var cb = pending.get(msg.id);
							pending.delete(msg.id);
							if (msg.error) cb.reject(msg.error);
							else cb.resolve(msg.result);
						}
					});

					ws.on('error', function (err) {
						process._rawDebug('[CDP] Error: ' + err.message);
						StrategyMCP.utils.clearCDP();
					});

					ws.on('close', function () {
						StrategyMCP.cdp.isConnected = false;
						process._rawDebug('[CDP] Connection closed');
					});

				} catch (e) {
					process._rawDebug('[CDP] Parse error: ' + e.message);
				}
			});
		});

		req.on('error', function (err) {
			return {
				success: false,
				error: 'Failed to connect: ' + err.message,
				host: host,
				port: port
			};
		});

		return {
			success: true,
			action: 'connect',
			host: host,
			port: port,
			message: 'CDP connection initiated',
			note: 'Connection is async. Check StrategyMCP.cdp.isConnected for status'
		};
	}

	if (action === 'disconnect') {
		StrategyMCP.utils.clearCDP();
		return {
			success: true,
			action: 'disconnect',
			message: 'CDP connection closed'
		};
	}

	if (action === 'evaluate') {
		if (!StrategyMCP.utils.isCDPConnected()) {
			return {
				success: false,
				error: 'Not connected to CDP. Use connection {action: "connect"} first'
			};
		}

		var code = args.code || 'undefined';
		var id = ++StrategyMCP.cdp.messageId;

		return new Promise(function (resolve, reject) {
			StrategyMCP.cdp.pending.set(id, {
				resolve: function (result) {
					resolve({
						success: true,
						action: 'evaluate',
						result: result
					});
				},
				reject: function (err) {
					resolve({
						success: false,
						action: 'evaluate',
						error: err
					});
				}
			});

			StrategyMCP.cdp.connection.send(JSON.stringify({
				id: id,
				method: 'Runtime.evaluate',
				params: {
					expression: code,
					returnByValue: true
				}
			}));
		});
	}

	// Default: status
	var cdp = StrategyMCP.cdp;
	return {
		success: true,
		action: 'status',
		connected: cdp.isConnected,
		host: cdp.host,
		port: cdp.port,
		target: cdp.target || null,
		message: cdp.isConnected ? 'CDP connected to ' + cdp.host + ':' + cdp.port : 'CDP not connected',
		lastUsed: cdp.lastUsed
	};

} catch (e) {
	return {
		success: false,
		error: e.message,
		stack: e.stack
	};
}
