/**
 * MCP Tool Metadata:
 * {
 *   "name": "communicate_with_instances",
 *   "description": "Query and communicate with living Mnemonica instances in runtime",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "action": {
 *         "type": "string",
 *         "enum": ["list", "query", "send", "call"],
 *         "description": "Action to perform on instances"
 *       },
 *       "instanceId": {
 *         "type": "string",
 *         "description": "Specific instance ID to target"
 *       },
 *       "data": {
 *         "type": "object",
 *         "description": "Data to send to instance"
 *       },
 *       "method": {
 *         "type": "string",
 *         "description": "Method name to call on instance"
 *       }
 *     },
 *     "required": ["action"]
 *   }
 * }
 */

// This script communicates with living Mnemonica instances in runtime
// Instances are stored in global.mnemonicaInstances Map

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

	var action = args.action || 'list';
	var instanceId = args.instanceId;
	var data = args.data || {};
	var method = args.method;

	try {
		// Access the global instance registry
		var registry = global.mnemonicaInstances;

		if (!registry) {
			return {
				error: 'Instance registry not found. Run create-test-instances first.'
			};
		}

		// Helper to get full instance info with prototype chain
		function getFullInstanceInfo (record) {
			var inst = record.instance;
			var info = {
				id: record.id,
				type: record.type,
				parent: record.parent,
				createdAt: record.createdAt,
				ownProperties: {},
				prototypeProperties: {},
				parentChain: []
			};

			// Get own enumerable properties
			Object.keys(inst).forEach(function (key) {
				try {
					var val = inst[key];
					if (typeof val !== 'function') {
						info.ownProperties[key] = val;
					} else {
						info.ownProperties[key] = '[Function]';
					}
				} catch (e) {}
			});

			// Walk the prototype chain
			var proto = Object.getPrototypeOf(inst);
			var depth = 0;
			while (proto && depth < 10) {
				var protoInfo = {
					constructor: proto.constructor ? proto.constructor.name : 'unknown',
					properties: []
				};

				Object.keys(proto).forEach(function (key) {
					try {
						var desc = Object.getOwnPropertyDescriptor(proto, key);
						if (desc && typeof desc.get === 'function') {
							protoInfo.properties.push(key + ' [getter]');
						} else if (typeof proto[key] === 'function') {
							protoInfo.properties.push(key + '()');
						}
					} catch (e) {}
				});

				info.parentChain.push(protoInfo);

				// Check for mnemonica parent reference
				var symbols = Object.getOwnPropertySymbols(proto);
				symbols.forEach(function (sym) {
					if (sym.toString() === 'Symbol(parent-type)') {
						try {
							var parent = proto[sym];
							if (parent && parent.constructor) {
								protoInfo.parentType = parent.constructor.name;
							}
						} catch (e) {}
					}
				});

				proto = Object.getPrototypeOf(proto);
				depth++;
			}

			return info;
		}

		switch (action) {
			case 'list': {
				var allInstances = [];
				registry.forEach(function (record) {
					allInstances.push({
						id: record.id,
						type: record.type,
						parent: record.parent,
						createdAt: record.createdAt,
						propertyCount: Object.keys(record.instance).length
					});
				});

				return {
					action: 'list',
					count: allInstances.length,
					instances: allInstances,
					message: 'Use instanceId with action "query" to get full details'
				};
			}

			case 'query': {
				if (!instanceId) {
					return {
						error: 'instanceId required for query action'
					};
				}

				var record = registry.get(instanceId);
				if (!record) {
					return {
						error: 'Instance not found: ' + instanceId
					};
				}

				return {
					action: 'query',
					instanceId: instanceId,
					info: getFullInstanceInfo(record)
				};
			}

			case 'send': {
				if (!instanceId) {
					return {
						error: 'instanceId required for send action'
					};
				}

				var record = registry.get(instanceId);
				if (!record) {
					return {
						error: 'Instance not found: ' + instanceId
					};
				}

				// Add message to instance
				var timestamp = new Date().toISOString();
				record.instance._lastMessage = {
					data: data,
					receivedAt: timestamp,
					sender: 'AI Agent'
				};

				return {
					action: 'send',
					instanceId: instanceId,
					message: 'Data sent to instance',
					data: data,
					timestamp: timestamp
				};
			}

			case 'call': {
				if (!instanceId || !method) {
					return {
						error: 'instanceId and method required for call action'
					};
				}

				var record = registry.get(instanceId);
				if (!record) {
					return {
						error: 'Instance not found: ' + instanceId
					};
				}

				var inst = record.instance;
				if (typeof inst[method] !== 'function') {
					return {
						error: 'Method ' + method + ' not found on instance'
					};
				}

				// Call the method
				var result = inst[method].call(inst, data);

				return {
					action: 'call',
					instanceId: instanceId,
					method: method,
					result: result
				};
			}

			default:
				return {
					error: 'Unknown action: ' + action
				};
		}
	} catch (error) {
		return {
			error: error.message,
			stack: error.stack
		};
	}
})();
