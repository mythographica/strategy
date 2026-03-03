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

// Destructure ctx from parent scope (passed by server.ts)
var { require, args, store } = ctx;

if (!store || !(store instanceof Map)) {
	return {
		success: false,
		error: 'store not initialized or not a Map'
	};
}

var action = args.action || 'status';

if (action === 'connect') {
	var host = args.host || 'localhost';
	var port = args.port || 9229;

	// Check if already connected to same host/port
	var existing = store.get('cdp');
	if (existing && existing.isConnected &&
	    existing.host === host && existing.port === port) {
		return {
			success: true,
			action: 'connect',
			message: 'Already connected to ' + host + ':' + port,
			reused: true
		};
	}

	// Close existing connection if different
	if (existing && existing.connection) {
		try { existing.connection.close(); } catch (e) {}
	}

	// Try to connect
	try {
		var CDP = require('chrome-remote-interface');
		var client = await CDP({ host: host, port: port });

		// Store connection in shared state Map
		store.set('cdp', {
			connection: client,
			isConnected: true,
			host: host,
			port: port,
			lastUsed: Date.now()
		});

		// Handle disconnection
		client.on('disconnect', function () {
			var cdp = store.get('cdp');
			if (cdp) {
				cdp.isConnected = false;
			}
		});

		return {
			success: true,
			action: 'connect',
			host: host,
			port: port,
			message: 'CDP connected successfully to ' + host + ':' + port
		};
	} catch (err) {
		store.set('cdp', {
			isConnected: false,
			host: host,
			port: port,
			error: err.message
		});

		return {
			success: false,
			action: 'connect',
			host: host,
			port: port,
			error: 'Failed to connect: ' + err.message
		};
	}
}

if (action === 'disconnect') {
	var cdp = store.get('cdp');
	if (cdp && cdp.connection) {
		try { cdp.connection.close(); } catch (e) {}
	}
	store.delete('cdp');
	return {
		success: true,
		action: 'disconnect',
		message: 'CDP connection closed'
	};
}

// Default: status
var cdp = store.get('cdp');
var status = {
	success: true,
	action: 'status',
	connected: cdp ? cdp.isConnected : false,
	host: cdp ? cdp.host : null,
	port: cdp ? cdp.port : null,
	message: (cdp && cdp.isConnected) ?
		'CDP connected to ' + cdp.host + ':' + cdp.port :
		'CDP not connected'
};

if (cdp && cdp.error) {
	status.error = cdp.error;
}

return status;
