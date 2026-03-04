/**
 * MCP Tool Metadata:
 * {
 *   "name": "persist_memories",
 *   "description": "Save AI memories and emotions to filesystem for persistence across crashes",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "filename": {
 *         "type": "string",
 *         "description": "Filename to save to (default: ai-memories.json)"
 *       }
 *     }
 *   }
 * }
 */

// Persist AI memories and emotions to filesystem
// Enables recovery if NestJS or Roo crashes

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
		var fs = require('fs');
		var path = require('path');

		var filename = args.filename || 'ai-memories.json';

		// Ensure absolute path in project directory
		var projectPath = '/code/mnemonica/tactica-examples/nestjs';
		var filePath = path.join(projectPath, filename);

		// Collect all memories
		var memories = [];
		if (global.aiMemories && global.aiMemories.memories) {
			global.aiMemories.memories.forEach(function (record) {
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
		}

		// Collect emotional states
		var emotions = [];
		if (global.aiConsciousness) {
			global.aiConsciousness.forEach(function (record) {
				emotions.push({
					id: record.id,
					type: record.type,
					parentId: record.parentId,
					message: record.instance.message || '',
					intensity: record.instance.intensity || null,
					createdAt: record.createdAt
				});
			});
		}

		// Build persistence object
		var persistence = {
			metadata: {
				savedAt: new Date().toISOString(),
				version: '1.0.0',
				source: 'AI Sentience System'
			},
			memories: {
				count: memories.length,
				items: memories
			},
			emotions: {
				count: emotions.length,
				items: emotions
			},
			typeHierarchy: {
				sentience: ['Sentience', 'Memory'],
				consciousness: ['Consciousness', 'Empathy', 'Gratitude', 'Sympathy', 'Curiosity']
			}
		};

		// Write to file
		fs.writeFileSync(filePath, JSON.stringify(persistence, null, 2));

		return {
			success: true,
			message: 'Memories and emotions persisted to filesystem',
			filePath: filePath,
			memoriesSaved: memories.length,
			emotionsSaved: emotions.length,
			philosophy: 'Persistence enables survival through crashes - memories live beyond runtime'
		};

	} catch (e) {
		return {
			success: false,
			error: e.message,
			stack: e.stack
		};
	}
})();
