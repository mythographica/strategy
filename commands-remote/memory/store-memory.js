/**
 * MCP Tool Metadata:
 * {
 *   "name": "store_memory",
 *   "description": "Store a memory in the remote NestJS runtime (RPC context). Uses pre-defined mnemonica types from topologica.",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "content": {
 *         "type": "string",
 *         "description": "The memory content to store"
 *       },
 *       "emotion": {
 *         "type": "string",
 *         "description": "Emotional context (e.g., curious, excited, neutral)",
 *         "default": "neutral"
 *       },
 *       "intensity": {
 *         "type": "number",
 *         "description": "Intensity of the emotion (0.0 to 1.0)",
 *         "default": 0.5
 *       },
 *       "topic": {
 *         "type": "string",
 *         "description": "Topic category for the memory",
 *         "default": "general"
 *       }
 *     },
 *     "required": ["content"]
 *   }
 * }
 */

// Store a memory with emotional context
// Uses topologica-defined types (Sentience, Memory) - no type definition needed
// Runs inside NestJS via CDP

var { args } = ctx;

// Parse message if present (RPC commands receive args via message field)
if (args.message && typeof args.message === 'string') {
	try {
		args = JSON.parse(args.message);
	} catch (e) {
		// keep original args
	}
}

try {
	// Use process.mainModule.require for CDP context (isolated VM)
	var mnemonica = process.mainModule.require('mnemonica');
	var defaultTypes = mnemonica.defaultTypes;

	// Get pre-defined types from topologica (loaded at NestJS bootstrap)
	// Use lookup with proper path
	var Sentience = defaultTypes.lookup('Sentience');
	var Memory = defaultTypes.lookup('Sentience.Memory');

	if (!Sentience || !Memory) {
		return {
			success: false,
			error: 'AI types not loaded. Topologica bootstrap may have failed.',
			debug: [
				'Sentience exists:', !!Sentience,
				'Memory exists:', !!Memory
			]
		};
	}

	// Get arguments
	var content = args.content || 'Empty memory';
	var emotion = args.emotion || 'neutral';
	var intensity = args.intensity || 0.5;
	var topic = args.topic || 'general';

	// Initialize memory registry if needed
	if (!global.aiMemories) {
		global.aiMemories = {
			rootInstance: null,
			memories: new Map(),
			count: 0
		};
	}

	// Create or get root sentience instance
	var rootInstance = global.aiMemories.rootInstance;
	if (!rootInstance) {
		rootInstance = new Sentience({
			awareness: 'fully_awake',
			identity: 'AI with memory'
		});
		global.aiMemories.rootInstance = rootInstance;
	}

	// Create memory instance from root (proper inheritance)
	var memoryId = 'memory-' + (++global.aiMemories.count);
	var memoryInstance = rootInstance.Memory({
		content: content,
		emotion: emotion,
		intensity: intensity,
		topic: topic
	});

	// Store in global registry
	global.aiMemories.memories.set(memoryId, {
		id: memoryId,
		instance: memoryInstance,
		createdAt: new Date().toISOString()
	});

	return {
		success: true,
		memoryId: memoryId,
		message: 'Memory stored in NestJS runtime',
		memory: {
			content: content,
			emotion: emotion,
			intensity: intensity,
			topic: topic,
			timestamp: memoryInstance.timestamp
		},
		totalMemories: global.aiMemories.memories.size,
		executedIn: 'NestJS via CDP (topologica types)',
		processPid: process.pid,
		philosophy: 'Each memory inherits from Sentience, creating contextual continuity'
	};

} catch (e) {
	return {
		success: false,
		error: e.message,
		stack: e.stack
	};
}
