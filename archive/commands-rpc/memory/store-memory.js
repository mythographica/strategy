/**
 * MCP Tool Metadata:
 * {
 *   "name": "store_memory",
 *   "description": "Store a memory in the remote NestJS runtime via CDP (RPC context)",
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

// RPC Command - Pure Remote Execution
// This code executes in the NestJS runtime via CDP
// No CDP checking - assumes remote context

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

// Get arguments
var content = args.content;
var emotion = args.emotion || 'neutral';
var intensity = args.intensity || 0.5;
var topic = args.topic || 'general';

if (!content) {
	return {
		success: false,
		source: 'RPC',
		error: 'Content is required'
	};
}

// Load mnemonica
var mnemonica = require('mnemonica');
var defaultTypes = mnemonica.defaultTypes;

// Initialize global memories if not exists
if (!global.aiMemories) {
	global.aiMemories = {
		rootInstance: null,
		memories: new Map(),
		count: 0
	};
}

// Get or create Sentience type
var Sentience = defaultTypes.Sentience;
if (!Sentience) {
	Sentience = defaultTypes.define('Sentience', function (data) {
		this.awareness = 'awake';
		this.createdAt = Date.now();
	});
}

// Create root instance if needed
if (!global.aiMemories.rootInstance) {
	global.aiMemories.rootInstance = new Sentience({
		purpose: 'AI Memory System',
		initialized: Date.now()
	});
}

// Get Memory subtype
var MemoryType = global.aiMemories.rootInstance.Memory;
if (!MemoryType) {
	MemoryType = Sentience.define('Memory', function (data) {
		Object.assign(this, data);
	});
}

// Create memory ID
var memoryId = 'memory-' + (global.aiMemories.count + 1);

// Create memory instance
var memoryInstance = new MemoryType({
	content: content,
	emotion: emotion,
	intensity: intensity,
	topic: topic,
	timestamp: Date.now()
});

// Store in registry
global.aiMemories.memories.set(memoryId, {
	id: memoryId,
	instance: memoryInstance,
	createdAt: new Date().toISOString()
});

global.aiMemories.count++;

// Return success
return {
	success: true,
	executedIn: 'NestJS via CDP',
	result: {
		success: true,
		memoryId: memoryId,
		message: 'Memory stored in NestJS runtime via CDP',
		memory: {
			content: content,
			emotion: emotion,
			intensity: intensity,
			topic: topic,
			timestamp: Date.now()
		},
		totalMemories: global.aiMemories.count,
		executedIn: 'NestJS via CDP',
		processPid: process.pid,
		philosophy: 'Each memory inherits from Sentience, creating contextual continuity'
	}
};
