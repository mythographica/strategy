/**
 * MCP Tool Metadata:
 * {
 *   "name": "rpc_connection",
 *   "description": "Manage CDP connections to Node.js runtimes (connect, disconnect, status). Multiple named slots are supported: the default slot is 'cdp', any other slot name stores an additional parallel connection (e.g. a fixture child on 9229 and a VS Code extension host on 9233 at the same time).",
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
 *       },
 *       "slot": {
 *         "type": "string",
 *         "description": "Named connection slot (default: the main 'cdp' slot). Use e.g. 'ext' for the VS Code extension host or 'test' for an --inspect-brk test process."
 *       }
 *     }
 *   },
 *   "examples": [
 *     {
 *       "description": "Connect to default runtime",
 *       "args": { "action": "connect" }
 *     },
 *     {
 *       "description": "Connect to the VS Code extension host in a named slot",
 *       "args": { "action": "connect", "port": 9233, "slot": "ext" }
 *     },
 *     {
 *       "description": "Check connection status (all slots)",
 *       "args": { "action": "status" }
 *     }
 *   ]
 * }
 */

// VERSION 3 - FINAL (+ named slots)
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
	var slot = commandArgs.slot || args.slot || '';
	// The default slot keeps the bare 'cdp' key — every existing command
	// reads store.get('cdp') and must not notice slots exist.
	var storeKey = slot ? ('cdp:' + slot) : 'cdp';
	debug.push('action: ' + action + ' | slot: ' + (slot || '(default)'));

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
				// Prefer a real mnemonica StrategyConnection node from the
				// runtime tree; plain-object fallback keeps the command
				// working when no StrategyServer constructed the runtime.
				var runtime = ctx.runtime;
				var cdpNode;
				if (runtime && typeof runtime.StrategyConnection === 'function') {
					cdpNode = new runtime.StrategyConnection(host, port);
					cdpNode.connection = client;
					cdpNode.isConnected = true;
				} else {
					cdpNode = {
						connection: client,
						isConnected: true,
						host: host,
						port: port
					};
				}
				cdpNode.slot = slot || 'cdp';
				store.set(storeKey, cdpNode);
			}

			return {
				success: true,
				action: 'connect',
				slot: slot || 'cdp',
				message: 'CDP connected to ' + host + ':' + port + ' (slot: ' + (slot || 'cdp') + ')',
				debug: debug
			};
		} catch (err) {
			debug.push('ERROR: ' + err.message);
			return {
				success: false,
				action: 'connect',
				slot: slot || 'cdp',
				error: err.message,
				debug: debug
			};
		}
	}

	// Disconnect
	if (action === 'disconnect') {
		var cdp = (store && store instanceof Map) ? store.get(storeKey) : null;
		if (cdp && cdp.connection) {
			try {
				await cdp.connection.close();
			} catch (e) {
				debug.push('close error: ' + e.message);
			}
			store.delete(storeKey);
			debug.push('disconnected');
			return {
				success: true,
				action: 'disconnect',
				slot: slot || 'cdp',
				message: 'CDP disconnected (slot: ' + (slot || 'cdp') + ')',
				debug: debug
			};
		}
		return {
			success: true,
			action: 'disconnect',
			slot: slot || 'cdp',
			message: 'CDP was not connected (slot: ' + (slot || 'cdp') + ')',
			debug: debug
		};
	}

	// Status: the requested slot, plus the list of every connected slot
	var cdpStatus = (store && store instanceof Map) ? store.get(storeKey) : null;
	var slots = [];
	if (store && store instanceof Map) {
		store.forEach(function (value, key) {
			if (typeof key === 'string' && key.indexOf('cdp') === 0 && value && value.isConnected) {
				slots.push({
					slot : value.slot || key,
					host : value.host,
					port : value.port
				});
			}
		});
	}
	return {
		success: true,
		action: 'status',
		slot: slot || 'cdp',
		connected: cdpStatus ? cdpStatus.isConnected : false,
		slots: slots,
		message: (cdpStatus && cdpStatus.isConnected) ? 'CDP connected' : 'CDP not connected',
		debug: debug
	};
} catch (outerErr) {
	return { success: false, error: outerErr.message, debug: debug };
}
