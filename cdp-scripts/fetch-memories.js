/**
 * Fetch memories from NestJS runtime
 * Returns memories array and emotions array for persistence
 */

(function () {
	try {
		if (!global.aiMemories) {
			return {
				success: true,
				memories: [],
				emotions: [],
				message: 'No memories in NestJS runtime'
			};
		}

		// Build memories array from Map
		var memoriesArray = [];
		global.aiMemories.memories.forEach(function (record, id) {
			try {
				var instance = record.instance;
				memoriesArray.push({
					id: id,
					content: instance.content || '',
					emotion: instance.emotion || 'neutral',
					intensity: instance.intensity || 0.5,
					topic: instance.topic || 'general',
					timestamp: instance.timestamp || Date.now(),
					createdAt: record.createdAt || new Date().toISOString()
				});
			} catch (e) {
				// Skip corrupted memory
			}
		});

		// Extract unique emotions
		var emotionsMap = {};
		memoriesArray.forEach(function (m) {
			var emotion = m.emotion || 'neutral';
			if (!emotionsMap[emotion]) {
				emotionsMap[emotion] = {
					id: emotion + '-' + Date.now(),
					type: emotion.charAt(0).toUpperCase() + emotion.slice(1),
					message: 'Feeling ' + emotion,
					intensity: m.intensity || 0.5
				};
			}
		});
		var emotionsArray = Object.values(emotionsMap);

		return {
			success: true,
			memories: memoriesArray,
			emotions: emotionsArray,
			memoryCount: memoriesArray.length,
			emotionCount: emotionsArray.length,
			executedIn: 'NestJS via CDP',
			processPid: process.pid
		};

	} catch (e) {
		return {
			success: false,
			error: e.message,
			executedIn: 'NestJS via CDP'
		};
	}
})();
