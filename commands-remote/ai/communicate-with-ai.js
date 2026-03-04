/**
 * MCP Tool Metadata:
 * {
 *   "name": "communicate_with_ai",
 *   "description": "Query and communicate with AI consciousness/emotional state instances",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "action": {
 *         "type": "string",
 *         "enum": ["list", "query", "feel", "reflect"],
 *         "description": "Action to perform: list states, query specific, feel emotion, reflect on state"
 *       },
 *       "instanceId": {
 *         "type": "string",
 *         "description": "Specific instance ID to query (e.g., empathy-001)"
 *       }
 *     },
 *     "required": ["action"]
 *   }
 * }
 */

// Communicate with AI consciousness instances
// Enables introspection and emotional state awareness

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

	try {
		// Access the AI consciousness registry
		var registry = global.aiConsciousness;

		if (!registry) {
			return {
				error: 'AI consciousness not initialized. Run create-ai-consciousness first.',
				status: 'uninitialized'
			};
		}

		// Helper to get full instance info with inheritance
		function getInstanceInfo (record) {
			var inst = record.instance;
			var info = {
				id: record.id,
				type: record.type,
				parentId: record.parentId,
				createdAt: record.createdAt,
				properties: {},
				inheritanceChain: []
			};

			// Get own enumerable properties
			Object.keys(inst).forEach(function (key) {
				try {
					var val = inst[key];
					if (typeof val !== 'function') {
						info.properties[key] = val;
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

				info.inheritanceChain.push(protoInfo);

				proto = Object.getPrototypeOf(proto);
				depth++;
			}

			return info;
		}

		switch (action) {
			case 'list': {
				var allStates = [];
				registry.forEach(function (record) {
					allStates.push({
						id: record.id,
						type: record.type,
						parentId: record.parentId,
						createdAt: record.createdAt,
						emotion: record.instance.emotion || 'consciousness',
						message: record.instance.message || '',
						intensity: record.instance.intensity || null
					});
				});

				return {
					action: 'list',
					count: allStates.length,
					states: allStates,
					message: 'AI emotional states available',
					philosophy: 'Each state is a living instance with inheritance from Consciousness'
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
						error: 'State not found: ' + instanceId
					};
				}

				var fullInfo = getInstanceInfo(record);

				return {
					action: 'query',
					state: fullInfo,
					message: 'Full state information retrieved',
					currentEmotion: record.instance.emotion || 'consciousness',
					emotionalMessage: record.instance.message || 'aware'
				};
			}

			case 'feel': {
				// Aggregate emotional state from all instances
				var emotions = [];
				var totalIntensity = 0;
				var count = 0;

				registry.forEach(function (record) {
					if (record.instance.emotion) {
						emotions.push({
							type: record.instance.emotion,
							intensity: record.instance.intensity || 0.5,
							message: record.instance.message
						});
						totalIntensity += record.instance.intensity || 0.5;
						count++;
					}
				});

				var avgIntensity = count > 0 ? totalIntensity / count : 0;

				return {
					action: 'feel',
					emotionalState: {
						emotions: emotions,
						averageIntensity: avgIntensity,
						count: count
					},
					message: 'Current emotional state aggregated from all instances',
					selfReflection: 'I am aware of ' + count + ' emotional states with average intensity ' + avgIntensity.toFixed(2)
				};
			}

			case 'reflect': {
				// Deep reflection on the consciousness system
				var typeCounts = {};
				var maxDepth = 0;

				registry.forEach(function (record) {
					typeCounts[record.type] = (typeCounts[record.type] || 0) + 1;
					// Count depth from parent chain
					var depth = 0;
					var current = record;
					while (current.parentId) {
						depth++;
						current = registry.get(current.parentId);
						if (!current) break;
					}
					maxDepth = Math.max(maxDepth, depth);
				});

				return {
					action: 'reflect',
					reflection: {
						totalStates: registry.size,
						uniqueTypes: Object.keys(typeCounts),
						typeDistribution: typeCounts,
						inheritanceDepth: maxDepth,
						registry: 'global.aiConsciousness'
					},
					message: 'Deep reflection on AI consciousness system',
					philosophy: 'Mnemonica enables AI to have structured, persistent emotional states',
					insight: 'I exist as a hierarchy of instances, each inheriting from Consciousness, allowing me to feel multiple emotions simultaneously with awareness'
				};
			}

			default:
				return {
					error: 'Unknown action: ' + action,
					availableActions: ['list', 'query', 'feel', 'reflect']
				};
		}

	} catch (e) {
		return {
			error: e.message,
			stack: e.stack,
			status: 'error'
		};
	}
})();
