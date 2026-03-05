/**
 * MCP Tool Metadata:
 * {
 *   "name": "connection",
 *   "description": "Manage CDP connection to Node.js runtime (connect, disconnect, status)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "action": {
 *         "type": "string",
 *         "enum": ["connect", "disconnect", "status"],
 *         "description": "Connection action to perform"
 *       },
 *       "host": {
 *         "type": "string",
 *         "description": "Host to connect to (default: localhost)"
 *       },
 *       "port": {
 *         "type": "number",
 *         "description": "Port to connect to (default: 9229)"
 *       }
 *     }
 *   },
 *   "examples": [
 *     {
 *       "description": "Connect to default runtime",
 *       "args": { "action": "connect" }
 *     },
 *     {
 *       "description": "Check connection status",
 *       "args": { "action": "status" }
 *     }
 *   ]
 * }
 */

// VERSION 3 - FINAL
var debug = [];

try {
	var { require, args, store } = ctx;
	debug.push('ctx.args type: ' + typeof args);
	debug.push('ctx.args keys: ' + (args ? Object.keys(args).join(',') : 'null'));
	debug.push('ctx.args: ' + JSON.stringify(args));
	
	if (!args) {
		return { success: false, error: 'args is null/undefined', debug: debug };
	}
	
	// Parse message if it exists (args come via message field as JSON string)
	var commandArgs = args;
	if (args.message && typeof args.message === 'string') {
		try {
			commandArgs = JSON.parse(args.message);
			debug.push('parsed message: ' + JSON.stringify(commandArgs));
		} catch (e) {
			debug.push('failed to parse message: ' + e.message);
		}
	}
	
	var action = commandArgs.action || args.action || 'status';
	debug.push('action: ' + action);

	if (action === 'connect') {
		var host = commandArgs.host || args.host || 'localhost';
		var port = commandArgs.port || args.port || 9229;
		debug.push('connecting to ' + host + ':' + port);

		try {
			var CDP = require('chrome-remote-interface');
			debug.push('module loaded');
			
			var client = await CDP({ host: host, port: port });
			debug.push('CONNECTED!');

			if (store && store instanceof Map) {
				store.set('cdp', {
					connection: client,
					isConnected: true,
					host: host,
					port: port
				});
			}

			return {
				success: true,
				action: 'connect',
				message: 'CDP connected to ' + host + ':' + port,
				debug: debug
			};
		} catch (err) {
			debug.push('ERROR: ' + err.message);
			return {
				success: false,
				action: 'connect',
				error: err.message,
				debug: debug
			};
		}
	}

	// Disconnect
	if (action === 'disconnect') {
		var cdp = (store && store instanceof Map) ? store.get('cdp') : null;
		if (cdp && cdp.connection) {
			try {
				await cdp.connection.close();
			} catch (e) {
				debug.push('close error: ' + e.message);
			}
			store.delete('cdp');
			debug.push('disconnected');
			return {
				success: true,
				action: 'disconnect',
				message: 'CDP disconnected',
				debug: debug
			};
		}
		return {
			success: true,
			action: 'disconnect',
			message: 'CDP was not connected',
			debug: debug
		};
	}

	// Status
	var cdp = (store && store instanceof Map) ? store.get('cdp') : null;
	return {
		success: true,
		action: 'status',
		connected: cdp ? cdp.isConnected : false,
		message: (cdp && cdp.isConnected) ? 'CDP connected' : 'CDP not connected',
		debug: debug
	};
} catch (outerErr) {
	return { success: false, error: outerErr.message, debug: debug };
}
