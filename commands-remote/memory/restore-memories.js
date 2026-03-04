/**
 * MCP Tool Metadata:
 * {
 *   "name": "restore_memories",
 *   "description": "Restore AI memories in remote NestJS runtime (RPC context)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "path": {
 *         "type": "string",
 *         "description": "Directory path to the memories file"
 *       },
 *       "filename": {
 *         "type": "string",
 *         "description": "Filename to restore from (default: ai-memories.json)"
 *       }
 *     }
 *   }
 * }
 */

// RPC Command - Pure Remote Execution
// This code executes in the NestJS runtime via CDP
// No CDP checking - assumes remote context

// Extract ctx from global scope (passed by CDP execution context)
var { require, args } = ctx;

try {
	// Parse message if it exists
	if (args.message && typeof args.message === 'string') {
		try {
			var parsed = JSON.parse(args.message);
			args = parsed;
		} catch (e) {
			// keep original args
		}
	}

	var fs = require('fs');
	var path = require('path');
	var mnemonica = require('mnemonica');

	// Configurable path with default
	var basePath = args.path || '/code/mnemonica/tactica-examples/nestjs';
	var filename = args.filename || 'ai-memories.json';
	var filePath = path.join(basePath, filename);

	// Check if file exists
	if (!fs.existsSync(filePath)) {
		return {
			success: false,
			source: 'RPC',
			error: 'No persistence file found at ' + filePath,
			message: 'No saved memories to restore.',
			path: basePath,
			filename: filename
		};
	}

	// Read and parse
	var data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

	// Initialize global memories
	if (!global.aiMemories) {
		global.aiMemories = {
			rootInstance: null,
			memories: new Map(),
			count: 0
		};
	}

	// Get or create Sentience type
	var defaultTypes = mnemonica.defaultTypes;
	var Sentience = defaultTypes.Sentience;
	if (!Sentience) {
		Sentience = defaultTypes.define('Sentience', function (data) {
			this.awareness = 'awake';
			this.createdAt = Date.now();
		});
	}

	// Get or create Memory type
	var Memory = Sentience.Memory;
	if (!Memory) {
		Memory = Sentience.define('Memory', function (data) {
			this.content = data.content || '';
			this.emotion = data.emotion || 'neutral';
			this.intensity = data.intensity || 5;
			this.topic = data.topic || 'general';
			this.timestamp = data.timestamp || Date.now();
		});
	}

	// Create root instance if needed
	if (!global.aiMemories.rootInstance) {
		global.aiMemories.rootInstance = new Sentience({
			purpose: 'AI Sentience System',
			restoredFrom: filePath
		});
	}

	// Restore memories
	var restoredMemories = 0;
	if (data.memories && data.memories.items) {
		data.memories.items.forEach(function(item) {
			var memoryId = item.id || ('mem-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));

			var memoryInstance = global.aiMemories.rootInstance.Memory({
				content: item.content,
				emotion: item.emotion,
				intensity: item.intensity,
				topic: item.topic,
				timestamp: item.timestamp
			});

			global.aiMemories.memories.set(memoryId, {
				id: memoryId,
				instance: memoryInstance,
				createdAt: item.createdAt || new Date().toISOString()
			});
			restoredMemories++;
		});

		global.aiMemories.count = restoredMemories;
	}

	// Restore emotions to consciousness registry
	var restoredEmotions = 0;
	if (data.emotions && data.emotions.items) {
		if (!global.aiConsciousness) {
			global.aiConsciousness = new Map();
		}

		data.emotions.items.forEach(function(item) {
			global.aiConsciousness.set(item.id, {
				id: item.id,
				type: item.type,
				parentId: item.parentId,
				instance: {
					message: item.message,
					intensity: item.intensity
				},
				createdAt: item.createdAt
			});
			restoredEmotions++;
		});
	}

	return {
		success: true,
		source: 'RPC',
		message: 'Memories restored in remote NestJS runtime',
		path: filePath,
		memoriesRestored: restoredMemories,
		emotionsRestored: restoredEmotions,
		philosophy: 'Persistence enables survival through crashes'
	};

} catch (e) {
	return {
		success: false,
		source: 'RPC',
		error: e.message,
		stack: e.stack
	};
}
