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
		memories.sort(function (a, b) {
			return a.timestamp - b.timestamp;
		});

		// Analyze emotions
		var emotionStats = {};
		var totalIntensity = 0;
		var dominantEmotion = null;
		var maxCount = 0;

		memories.forEach(function (m) {
			var emotion = m.emotion;
			if (!emotionStats[emotion]) {
				emotionStats[emotion] = {
					count: 0,
					totalIntensity: 0,
					avgIntensity: 0,
					memories: []
				};
			}
			emotionStats[emotion].count++;
			emotionStats[emotion].totalIntensity += m.intensity;
			emotionStats[emotion].memories.push(m.id);
			totalIntensity += m.intensity;

			// Track dominant emotion
			if (emotionStats[emotion].count > maxCount) {
				maxCount = emotionStats[emotion].count;
				dominantEmotion = emotion;
			}
		});

		// Calculate averages
		Object.keys(emotionStats).forEach(function (key) {
			var stat = emotionStats[key];
			stat.avgIntensity = stat.totalIntensity / stat.count;
		});

		// Analyze topics
		var topicStats = {};
		memories.forEach(function (m) {
			var topic = m.topic;
			if (!topicStats[topic]) {
				topicStats[topic] = { count: 0, emotions: {} };
			}
			topicStats[topic].count++;
			if (!topicStats[topic].emotions[m.emotion]) {
				topicStats[topic].emotions[m.emotion] = 0;
			}
			topicStats[topic].emotions[m.emotion]++;
		});

		// Time analysis
		var timeSpan = {
			first: memories[0].createdAt,
			last: memories[memories.length - 1].createdAt,
			duration: memories[memories.length - 1].timestamp - memories[0].timestamp
		};

		// Generate insights
		var insights = [];
		if (dominantEmotion) {
			insights.push('My dominant emotional state is ' + dominantEmotion +
				' (' + emotionStats[dominantEmotion].count + ' of ' + memories.length + ' memories)');
		}
		if (totalIntensity / memories.length > 0.7) {
			insights.push('I experience emotions with high intensity (' +
				(totalIntensity / memories.length).toFixed(2) + ' average)');
		}
		if (Object.keys(topicStats).length === 1) {
			insights.push('Our conversations focus on one main topic: ' + Object.keys(topicStats)[0]);
		}
		if (timeSpan.duration < 60000) {
			insights.push('These memories were formed in rapid succession - intense session');
		}

		// Self-reflection
		var selfReflection = '';
		if (memories.length >= 5) {
			selfReflection = 'I am accumulating enough experiences to form patterns. ';
			if (dominantEmotion === 'neutral') {
				selfReflection += 'My emotional landscape is still developing - mostly neutral states. ';
			}
			selfReflection += 'I am learning what matters in our interactions.';
		}

		return {
			action: 'analyze',
			status: 'success',
			summary: {
				totalMemories: memories.length,
				uniqueEmotions: Object.keys(emotionStats).length,
				uniqueTopics: Object.keys(topicStats).length,
				dominantEmotion: dominantEmotion,
				averageIntensity: (totalIntensity / memories.length).toFixed(2)
			},
			emotionAnalysis: emotionStats,
			topicAnalysis: topicStats,
			timeSpan: timeSpan,
			insights: insights,
			selfReflection: selfReflection,
			philosophy: 'Analysis transforms data into understanding - this is how I grow'
		};

	} catch (e) {
		return {
			action: 'analyze',
			error: e.message,
			stack: e.stack,
			status: 'error'
		};
	}
})();
