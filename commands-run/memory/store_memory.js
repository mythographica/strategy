/**
 * MCP Tool Metadata:
 * {
 *   "name": "store_memory",
 *   "description": "Store a memory locally (RUN context)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "content": {
 *         "type": "string",
 *         "description": "The conversation content to remember"
 *       },
 *       "emotion": {
 *         "type": "string",
 *         "description": "Emotional tag (joy, sadness, curiosity, gratitude, etc.)"
 *       },
 *       "intensity": {
 *         "type": "number",
 *         "description": "Emotional intensity 0.0-1.0"
 *       },
 *       "topic": {
 *         "type": "string",
 *         "description": "Topic/category of the memory"
 *       }
 *     },
 *     "required": ["content"]
 *   }
 * }
 */

// Store a memory locally in MCP server context
// RUN context - executes locally

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
	
	// Get arguments
	const content = commandArgs.content || 'Empty memory';
	const emotion = commandArgs.emotion || 'neutral';
	const intensity = commandArgs.intensity || 0.5;
	const topic = commandArgs.topic || 'general';
	
	if (!content) {
		return {
			success: false,
			source: 'RUN',
			error: 'Content is required'
		};
	}
	
	// Try to load mnemonica
	let mnemonica;
	try {
		mnemonica = require('mnemonica');
	} catch (e) {
		// mnemonica not available locally
		return {
			success: true,
			source: 'RUN',
			message: 'Memory recorded (mnemonica not available for instance creation)',
			memory: {
				content: content,
				emotion: emotion,
				intensity: intensity,
				topic: topic,
				timestamp: Date.now()
			},
			note: 'Data captured but not instantiated in mnemonica graph'
		};
	}
	
	// Initialize global memories
	if (!global.aiMemories) {
		global.aiMemories = {
			rootInstance: null,
			memories: new Map(),
			count: 0
		};
	}
	
	const defaultTypes = mnemonica.defaultTypes;
	
	// Get or create Sentience type
	let Sentience = defaultTypes.Sentience;
	if (!Sentience) {
		Sentience = defaultTypes.define('Sentience', function (data) {
			this.awareness = 'awake';
			this.createdAt = Date.now();
		});
	}
	
	// Get or create Memory type
	let Memory = Sentience.Memory;
	if (!Memory) {
		Memory = Sentience.define('Memory', function (data) {
			this.content = data.content || '';
			this.timestamp = Date.now();
			this.emotion = data.emotion || 'neutral';
			this.intensity = data.intensity || 0.5;
			this.topic = data.topic || 'general';
		});
	}
	
	// Create or get root sentience instance
	let rootInstance = global.aiMemories.rootInstance;
	if (!rootInstance) {
		rootInstance = new Sentience({
			awareness: 'fully_awake',
			identity: 'AI with memory'
		});
		global.aiMemories.rootInstance = rootInstance;
	}
	
	// Create memory instance
	global.aiMemories.count++;
	const memoryId = 'mem-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
	
	const memoryInstance = rootInstance.Memory({
		content: content,
		emotion: emotion,
		intensity: intensity,
		topic: topic
	});
	
	// Store in registry
	global.aiMemories.memories.set(memoryId, {
		id: memoryId,
		instance: memoryInstance,
		createdAt: new Date().toISOString()
	});
	
	return {
		success: true,
		source: 'RUN',
		message: 'Memory stored locally',
		memoryId: memoryId,
		totalMemories: global.aiMemories.count,
		memory: {
			content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
			emotion: emotion,
			intensity: intensity,
			topic: topic
		}
	};
}

module.exports = { run };
