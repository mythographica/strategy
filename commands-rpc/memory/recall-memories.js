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

// Extract ctx from global scope (passed by CDP execution context)
var { require, args } = ctx;

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

	// Collect all memories
	var allMemories = [];
	registry.memories.forEach(function (record) {
		allMemories.push({
			id: record.id,
			content: record.instance.content,
			emotion: record.instance.emotion,
			intensity: record.instance.intensity,
			topic: record.instance.topic,
			timestamp: record.instance.timestamp,
			createdAt: record.createdAt
		});
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

	// Sort by timestamp (newest first)
	filtered.sort(function (a, b) { return b.timestamp - a.timestamp; });

	// Apply limit
	var limited = filtered.slice(0, limit);

	// Calculate stats
	var emotionCounts = {};
	limited.forEach(function (m) {
		if (!emotionCounts[m.emotion]) {
			emotionCounts[m.emotion] = 0;
		}
		emotionCounts[m.emotion]++;
	});

	return {
		action: 'recall',
		status: 'success',
		count: limited.length,
		totalAvailable: allMemories.length,
		filter: {
			applied: !!(filter || emotion),
			filter: filter,
			emotion: emotion
		},
		memories: limited,
		emotionBreakdown: emotionCounts,
		message: 'Retrieved ' + limited.length + ' memories' +
			(filter ? ' matching "' + filter + '"' : '') +
			(emotion ? ' with emotion "' + emotion + '"' : '')
	};

} catch (e) {
	return {
		action: 'recall',
		status: 'error',
		error: e.message,
		stack: e.stack
	};
}
