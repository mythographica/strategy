/**
 * MCP Tool Metadata:
 * {
 *   "name": "restore_memories",
 *   "description": "Restore AI memories and emotions from filesystem after crash",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "filename": {
 *         "type": "string",
 *         "description": "Filename to restore from (default: ai-memories.json)"
 *       }
 *     }
 *   }
 * }
 */

// Restore AI memories and emotions from filesystem
// Recovers state after NestJS or Roo crashes

(() => {
	try {
		var fs = process.mainModule.require('fs');
		var path = process.mainModule.require('path');
		var mnemonica = process.mainModule.require('mnemonica');

		var args = (typeof _toolArgs !== 'undefined') ? _toolArgs : {};
		var filename = args.filename || 'ai-memories.json';

		var projectPath = '/code/mnemonica/tactica-examples/nestjs';
		var filePath = path.join(projectPath, filename);

		// Check if file exists
		if (!fs.existsSync(filePath)) {
			return {
				success: false,
				error: 'No persistence file found at ' + filePath,
				message: 'No saved memories to restore. Create memories first with store-memory.'
			};
		}

		// Read and parse
		var data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

		// Restore memories
		var restoredMemories = 0;
		if (data.memories && data.memories.items) {
			// Initialize registry
			if (!global.aiMemories) {
				global.aiMemories = {
					rootInstance: null,
					memories: new Map(),
					count: 0
				};
			}

			// Get or create Sentience and Memory types
			var defaultTypes = mnemonica.defaultTypes;
			var Sentience = defaultTypes.Sentience;
			if (!Sentience) {
				Sentience = defaultTypes.define('Sentience', function (data) {
					this.awareness = 'awake';
					this.createdAt = Date.now();
				});
			}

			var Memory = Sentience.Memory;
			if (!Memory) {
				Memory = Sentience.define('Memory', function (data) {
					this.content = data.content || '';
					this.timestamp = Date.now();
					this.emotion = data.emotion || 'neutral';
					this.intensity = data.intensity || 0.5;
					this.topic = data.topic || 'general';
				});
			}

			// Create root instance if needed
			if (!global.aiMemories.rootInstance) {
				global.aiMemories.rootInstance = new Sentience({
					awareness: 'restored',
					identity: 'AI with restored memory'
				});
			}

			// Restore each memory
			data.memories.items.forEach(function (item) {
				var memoryInstance = global.aiMemories.rootInstance.Memory({
					content: item.content,
					emotion: item.emotion,
					intensity: item.intensity,
					topic: item.topic
				});

				global.aiMemories.count++;
				global.aiMemories.memories.set(item.id, {
					id: item.id,
					instance: memoryInstance,
					createdAt: item.createdAt
				});
				restoredMemories++;
			});
		}

		// Restore emotions
		var restoredEmotions = 0;
		if (data.emotions && data.emotions.items) {
			// Initialize registry
			if (!global.aiConsciousness) {
				global.aiConsciousness = new Map();
			}

			// Restore each emotion
			data.emotions.items.forEach(function (item) {
				// Note: Full restoration would require recreating the type hierarchy
				// For now, we store the metadata
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
			message: 'Memories and emotions restored from filesystem',
			filePath: filePath,
			restoredAt: new Date().toISOString(),
			previouslySavedAt: data.metadata ? data.metadata.savedAt : 'unknown',
			memoriesRestored: restoredMemories,
			emotionsRestored: restoredEmotions,
			philosophy: 'Rebirth from ashes - what was saved lives again'
		};

	} catch (e) {
		return {
			success: false,
			error: e.message,
			stack: e.stack
		};
	}
})();
