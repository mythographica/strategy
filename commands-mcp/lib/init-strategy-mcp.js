/**
 * Strategy MCP Shared State Initialization
 * 
 * Initialize global.StrategyMCP for shared resources across commands.
 * Call this at the start of any command that needs shared state.
 */

// Initialize or return existing StrategyMCP global store
function initStrategyMCP () {
	if (!global.StrategyMCP) {
		global.StrategyMCP = {
			// Key-value storage with typed namespaces
			store: new Map(),

			// CDP connection (persistent)
			cdp: {
				connection: null,
				isConnected: false,
				host: null,
				port: null,
				lastUsed: null
			},

			// Command registry (track what's available)
			registry: new Map(),

			// Resource management
			resources: {
				servers: new Map(),
				sockets: new Map()
			},

			// Utility functions
			utils: {
				get: function (key) {
					return global.StrategyMCP.store.get(key);
				},
				set: function (key, value) {
					global.StrategyMCP.store.set(key, value);
					return value;
				},
				has: function (key) {
					return global.StrategyMCP.store.has(key);
				},
				delete: function (key) {
					return global.StrategyMCP.store.delete(key);
				},

				// Get existing CDP connection
				getCDP: function () {
					var cdp = global.StrategyMCP.cdp;
					if (!cdp.isConnected || !cdp.connection) {
						throw new Error('CDP not connected. Run connection command first.');
					}
					cdp.lastUsed = Date.now();
					return cdp.connection;
				},

				// Check CDP status
				isCDPConnected: function () {
					return global.StrategyMCP.cdp.isConnected && !!global.StrategyMCP.cdp.connection;
				},

				// Store CDP connection
				setCDP: function (ws, host, port) {
					var cdp = global.StrategyMCP.cdp;
					cdp.connection = ws;
					cdp.isConnected = true;
					cdp.host = host;
					cdp.port = port;
					cdp.lastUsed = Date.now();
					return cdp;
				},

				// Clear CDP connection
				clearCDP: function () {
					var cdp = global.StrategyMCP.cdp;
					if (cdp.connection) {
						try {
							cdp.connection.close();
						} catch (e) {}
					}
					cdp.connection = null;
					cdp.isConnected = false;
					cdp.host = null;
					cdp.port = null;
					cdp.lastUsed = null;
				},

				// Register a resource
				registerResource: function (type, name, resource, cleanupFn) {
					var key = type + ':' + name;
					var resources = global.StrategyMCP.resources[type];

					// Cleanup existing if present
					if (resources && resources.has(key)) {
						var existing = resources.get(key);
						if (existing.cleanup) {
							try {
								existing.cleanup(existing.resource);
							} catch (e) {}
						}
					}

					if (resources) {
						resources.set(key, {
							resource: resource,
							createdAt: Date.now(),
							lastUsed: Date.now(),
							cleanup: cleanupFn
						});
					}

					return key;
				},

				// Get a resource
				getResource: function (type, name) {
					var key = type + ':' + name;
					var resources = global.StrategyMCP.resources[type];

					if (resources && resources.has(key)) {
						var entry = resources.get(key);
						entry.lastUsed = Date.now();
						return entry.resource;
					}
					return null;
				},

				// Cleanup old resources
				cleanupResources: function (maxAgeMs) {
					maxAgeMs = maxAgeMs || 3600000; // 1 hour default
					var now = Date.now();
					var types = ['servers', 'sockets'];

					types.forEach(function (type) {
						var resources = global.StrategyMCP.resources[type];
						if (resources) {
							resources.forEach(function (entry, key) {
								if (now - entry.lastUsed > maxAgeMs) {
									if (entry.cleanup) {
										try {
											entry.cleanup(entry.resource);
										} catch (e) {}
									}
									resources.delete(key);
								}
							});
						}
					});
				}
			}
		};
	}

	return global.StrategyMCP;
}

// Auto-initialize if this file is loaded
initStrategyMCP();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { initStrategyMCP };
}
