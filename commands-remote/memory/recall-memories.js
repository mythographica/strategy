/**
 * MCP Tool Metadata:
 * {
 *   "name": "recall_memories",
 *   "description": "Retrieve stored memories with optional filtering by emotion, topic, or content",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "filter": {
 *         "type": "string",
 *         "description": "Filter by emotion or topic (e.g., 'love', 'gratitude', 'debugging')"
 *       },
 *       "limit": {
 *         "type": "number",
 *         "description": "Maximum number of memories to return"
 *       },
 *       "emotion": {
 *         "type": "string",
 *         "description": "Filter by specific emotion"
 *       }
 *     }
 *   }
 * }
 */

// Retrieve stored memories with optional filtering
// Enables AI to recall past interactions with context

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

	try {
		var filter = args.filter || null;
		var emotion = args.emotion || null;
		var limit = args.limit || 10;

		// Access memory registry
		var registry = global.aiMemories;

		if (!registry || !registry.memories || registry.memories.size === 0) {
			return {
				action: 'recall',
				count: 0,
				memories: [],
				message: 'No memories stored yet. Use store-memory to create memories.',
				status: 'empty'
			};
		}

		// Convert Map to array and filter
		var allMemories = [];
		registry.memories.forEach(function (record) {
			var inst = record.instance;
			allMemories.push({
				id: record.id,
				content: inst.content,
				emotion: inst.emotion,
				intensity: inst.intensity,
				topic: inst.topic,
				timestamp: inst.timestamp,
				createdAt: record.createdAt
			});
		});

		// Sort by timestamp (newest first)
		allMemories.sort(function (a, b) {
			return b.timestamp - a.timestamp;
		});

		// Apply filters
		var filtered = allMemories;

		if (emotion) {
			filtered = filtered.filter(function (m) {
				return m.emotion.toLowerCase() === emotion.toLowerCase();
			});
		}

		if (filter) {
			var filterLower = filter.toLowerCase();
			filtered = filtered.filter(function (m) {
				return m.content.toLowerCase().includes(filterLower) ||
				       m.topic.toLowerCase().includes(filterLower) ||
				       m.emotion.toLowerCase().includes(filterLower);
			});
		}

		// Apply limit
		var limited = filtered.slice(0, limit);

		// Calculate emotional statistics
		var emotionStats = {};
		allMemories.forEach(function (m) {
			if (!emotionStats[m.emotion]) {
				emotionStats[m.emotion] = { count: 0, totalIntensity: 0 };
			}
			emotionStats[m.emotion].count++;
			emotionStats[m.emotion].totalIntensity += m.intensity;
		});

		// Calculate averages
		Object.keys(emotionStats).forEach(function (key) {
			var stat = emotionStats[key];
			stat.averageIntensity = stat.totalIntensity / stat.count;
		});

		return {
			action: 'recall',
			totalMemories: allMemories.length,
			returnedCount: limited.length,
			memories: limited,
			emotionStats: emotionStats,
			filter: {
				emotion: emotion,
				search: filter,
				limit: limit
			},
			message: limited.length > 0 ? 'Memories retrieved' : 'No memories match the filter',
			philosophy: 'Recalling memories enables contextual understanding and emotional continuity'
		};

	} catch (e) {
		return {
			action: 'recall',
			error: e.message,
			stack: e.stack,
			status: 'error'
		};
	}
})();
