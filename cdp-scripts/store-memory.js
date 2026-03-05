/**
 * Store a memory in NestJS runtime via CDP
 * Creates mnemonica instances for memories with emotional context
 */

(function() {
	try {
		// Use process.mainModule.require for CDP context (isolated VM)
		var mnemonica = process.mainModule.require('mnemonica');
		var defaultTypes = mnemonica.defaultTypes;

		// Get or create Sentience root type using lookup (proper mnemonica API)
		var Sentience = defaultTypes.lookup('Sentience');
		if (!Sentience) {
			Sentience = defaultTypes.define('Sentience', function (data) {
				this.awareness = 'awake';
				this.createdAt = Date.now();
			});
		}

		// Get or create Memory type under Sentience using lookup
		var Memory = Sentience.lookup('Memory');
		if (!Memory) {
			Memory = Sentience.define('Memory', function (data) {
				this.content = data.content || '';
				this.timestamp = Date.now();
				this.emotion = data.emotion || 'neutral';
				this.intensity = data.intensity || 0.5;
				this.topic = data.topic || 'general';
			});
		}

		// Get arguments from injected args
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
		var memoryInstance = rootInstance.Memory({
			content: content,
			emotion: emotion,
			intensity: intensity,
			topic: topic
		});

		// Store with unique ID
		var memoryId = 'memory-' + (++global.aiMemories.count);
		global.aiMemories.memories.set(memoryId, {
			id: memoryId,
			instance: memoryInstance,
			createdAt: new Date().toISOString()
		});

		return {
			success: true,
			memoryId: memoryId,
			message: 'Memory stored in NestJS runtime via CDP',
			memory: {
				content: content,
				emotion: emotion,
				intensity: intensity,
				topic: topic,
				timestamp: memoryInstance.timestamp
			},
			totalMemories: global.aiMemories.count,
			executedIn: 'NestJS via CDP',
			processPid: process.pid,
			philosophy: 'Each memory inherits from Sentience, creating contextual continuity'
		};

	} catch (e) {
		return {
			success: false,
			error: e.message,
			stack: e.stack,
			executedIn: 'NestJS via CDP'
		};
	}
})();
