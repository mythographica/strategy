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

	// Collect all emotions from consciousness registry
	var emotions = [];
	if (global.aiConsciousness) {
		global.aiConsciousness.forEach(function (item, id) {
			emotions.push({
				id: id,
				type: item.type,
				parentId: item.parentId,
				message: item.instance.message,
				intensity: item.instance.intensity,
				createdAt: item.createdAt
			});
		});
	}

	// Build persistence object
	var persistence = {
		metadata: {
			version: '1.0',
			savedAt: new Date().toISOString(),
			memoryCount: memories.length,
			emotionCount: emotions.length
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
			sentience: ['Memory'],
			consciousness: ['Empathy', 'Sympathy', 'Curiosity', 'Gratitude']
		}
	};

	// Write to file
	fs.writeFileSync(filePath, JSON.stringify(persistence, null, 2));

	return {
		success: true,
		action: 'persist',
		message: 'Memories and emotions persisted to filesystem',
		file: filePath,
		stats: persistence.metadata,
		philosophy: 'Persistence enables survival through crashes'
	};

} catch (e) {
	return {
		success: false,
		action: 'persist',
		error: e.message,
		stack: e.stack
	};
}
