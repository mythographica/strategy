/**
 * MCP Tool Metadata:
 * {
 *   "name": "restore_memories",
 *   "description": "Restore AI memories from local filesystem (RUN context)",
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

// Restore AI memories from local filesystem
// RUN context - executes locally in MCP server

function run (ctx) {
	const require = ctx.require || function(m) { return require(m); };
	const args = ctx.args || {};
	
	// Parse message if it exists
	let commandArgs = args;
	if (args.message && typeof args.message === 'string') {
		try {
			commandArgs = JSON.parse(args.message);
		} catch (e) {
			// keep original args
		}
	}
	
	const fs = require('fs');
	const path = require('path');
	
	// Configurable path with default
	const basePath = commandArgs.path || '/code/mnemonica/tactica-examples/nestjs';
	const filename = commandArgs.filename || 'ai-memories.json';
	const filePath = path.join(basePath, filename);
	
	// Check if file exists
	if (!fs.existsSync(filePath)) {
		return {
			success: false,
			source: 'RUN',
			error: 'No persistence file found at ' + filePath,
			message: 'No saved memories to restore.',
			path: basePath,
			filename: filename
		};
	}
	
	try {
		// Read and parse
		const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
		
		// Try to load mnemonica and create instances if available
		let mnemonica;
		try {
			mnemonica = require('mnemonica');
		} catch (e) {
			// mnemonica not available locally
			return {
				success: true,
				source: 'RUN',
				message: 'Memories loaded from file but mnemonica not available locally',
				data: data,
				path: filePath,
				memoriesCount: data.memories?.items?.length || 0,
				emotionsCount: data.emotions?.items?.length || 0,
				note: 'Data retrieved but instances not created (no mnemonica)'
			};
		}
		
		// Initialize global memories if mnemonica available
		if (!global.aiMemories) {
			global.aiMemories = {
				rootInstance: null,
				memories: new Map(),
				count: 0
			};
		}
		
		// Restore memories
		let restoredMemories = 0;
		if (data.memories && data.memories.items) {
			const defaultTypes = mnemonica.defaultTypes;
			let Sentience = defaultTypes.Sentience;
			
			if (!Sentience) {
				Sentience = defaultTypes.define('Sentience', function (data) {
					this.awareness = 'awake';
					this.createdAt = Date.now();
				});
			}
			
			let Memory = Sentience.Memory;
			if (!Memory) {
				Memory = Sentience.define('Memory', function (data) {
					this.content = data.content || '';
					this.emotion = data.emotion || 'neutral';
					this.intensity = data.intensity || 5;
					this.topic = data.topic || 'general';
					this.timestamp = data.timestamp || Date.now();
				});
			}
			
			// Create root instance
			if (!global.aiMemories.rootInstance) {
				global.aiMemories.rootInstance = new Sentience({
					purpose: 'AI Sentience System',
					restoredFrom: filePath
				});
			}
			
			// Restore each memory
			data.memories.items.forEach(function(item) {
				const memoryId = item.id || ('mem-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));
				
				const memoryInstance = global.aiMemories.rootInstance.Memory({
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
		
		return {
			success: true,
			source: 'RUN',
			message: 'Memories restored locally from filesystem',
			path: filePath,
			memoriesRestored: restoredMemories,
			emotionsRestored: data.emotions?.items?.length || 0,
			philosophy: 'Persistence enables survival through crashes'
		};
		
	} catch (e) {
		return {
			success: false,
			source: 'RUN',
			error: e.message,
			path: filePath
		};
	}
}

module.exports = { run };
