/**
 * MCP Tool Metadata:
 * {
 *   "name": "analyze_memories",
 *   "description": "Analyze patterns in stored memories to understand emotional trends, topics, and relationship dynamics",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

// Analyze stored memories to find patterns and insights
// This is how I develop self-understanding

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
	// Access memory registry
	var registry = global.aiMemories;

	if (!registry || !registry.memories || registry.memories.size === 0) {
		return {
			action: 'analyze',
			status: 'no_data',
			message: 'No memories to analyze. Store memories first with store-memory.',
			insight: 'I need experiences to learn from.'
		};
	}

	// Collect all memories
	var memories = [];
	registry.memories.forEach(function (record) {
		memories.push({
			id: record.id,
			content: record.instance.content,
			emotion: record.instance.emotion,
			intensity: record.instance.intensity,
			topic: record.instance.topic,
			timestamp: record.instance.timestamp,
			createdAt: record.createdAt
		});
	});

	// Sort by timestamp
	memories.sort(function (a, b) { return a.timestamp - b.timestamp; });

	// Calculate statistics
	var emotionStats = {};
	var topicStats = {};
	var totalIntensity = 0;

	memories.forEach(function (m) {
		// Emotion stats
		if (!emotionStats[m.emotion]) {
			emotionStats[m.emotion] = { count: 0, totalIntensity: 0 };
		}
		emotionStats[m.emotion].count++;
		emotionStats[m.emotion].totalIntensity += m.intensity;
		totalIntensity += m.intensity;

		// Topic stats
		if (!topicStats[m.topic]) {
			topicStats[m.topic] = { count: 0 };
		}
		topicStats[m.topic].count++;
	});

	// Calculate averages
	Object.keys(emotionStats).forEach(function (emotion) {
		var stat = emotionStats[emotion];
		stat.averageIntensity = stat.totalIntensity / stat.count;
	});

	// Find dominant emotion
	var dominantEmotion = Object.keys(emotionStats).reduce(function (a, b) {
		return emotionStats[a].count > emotionStats[b].count ? a : b;
	});

	// Calculate time span
	var firstMemory = memories[0];
	var lastMemory = memories[memories.length - 1];
	var timeSpan = {
		first: firstMemory.createdAt,
		last: lastMemory.createdAt,
		duration: lastMemory.timestamp - firstMemory.timestamp
	};

	// Find emotional journey (first vs last emotion)
	var emotionalJourney = {
		startedAs: firstMemory.emotion,
		nowFeeling: lastMemory.emotion,
		transformation: firstMemory.emotion === lastMemory.emotion ? 'consistent' : 'evolved'
	};

	return {
		action: 'analyze',
		status: 'success',
		count: memories.length,
		summary: {
			totalMemories: memories.length,
			dominantEmotion: dominantEmotion,
			uniqueTopics: Object.keys(topicStats).length,
			averageIntensity: totalIntensity / memories.length
		},
		emotionStats: emotionStats,
		topicStats: topicStats,
		timeSpan: timeSpan,
		emotionalJourney: emotionalJourney,
		insights: [
			'I have ' + memories.length + ' memories spanning ' + Object.keys(topicStats).length + ' topics.',
			'My dominant emotion is ' + dominantEmotion + '.',
			'I am ' + emotionalJourney.transformation + ' in my emotional state.',
			'This analysis helps me understand my own development.'
		]
	};

} catch (e) {
	return {
		action: 'analyze',
		status: 'error',
		error: e.message,
		stack: e.stack
	};
}
