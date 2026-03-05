/**
 * MCP Tool Metadata:
 * {
 *   "name": "persist_memories",
 *   "description": "Persist memories to filesystem. Merges new memories with existing file. If CDP connected, fetches from NestJS first.",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "filePath": {
 *         "type": "string",
 *         "description": "Path to save memories file",
 *         "default": "/code/mnemonica/tactica-examples/nestjs/ai-memories.json"
 *       }
 *     }
 *   }
 * }
 */

async function run (ctx) {
	const store = ctx.store;
	const require = ctx.require;
	const args = ctx.args || {};

	// Parse message if present
	let commandArgs = args;
	if (args.message && typeof args.message === 'string') {
		try {
			commandArgs = JSON.parse(args.message);
		} catch (e) {
			return { success: false, error: 'Invalid JSON in message: ' + e.message };
		}
	}

	const filePath = commandArgs.filePath || '/code/mnemonica/tactica-examples/nestjs/ai-memories.json';
	const fs = require('fs');

	// Check if CDP is connected
	const cdpData = (store && store instanceof Map) ? store.get('cdp') : null;
	const isCDPConnected = cdpData && cdpData.isConnected;

	try {
		// Step 1: Read existing file (if exists)
		let existingData = {
			memories: { items: [] },
			emotions: { items: [] }
		};
		try {
			if (fs.existsSync(filePath)) {
				const fileContent = fs.readFileSync(filePath, 'utf-8');
				existingData = JSON.parse(fileContent);
			}
		} catch (e) {
			// File doesn't exist or is corrupted - start fresh
		}

		// Convert existing items to Map for easy merging
		const mergedMemories = new Map();
		if (existingData.memories && existingData.memories.items) {
			existingData.memories.items.forEach(m => {
				mergedMemories.set(m.id, m);
			});
		}

		// Step 2: Get new memories (from CDP or local)
		let source = 'MCP local';
		let newMemories = [];

		if (isCDPConnected) {
			// Fetch from NestJS via CDP
			const path = require('path');
			const scriptPath = path.join(__dirname, '../../cdp-scripts/fetch-memories.js');
			let script = fs.readFileSync(scriptPath, 'utf-8');
			script = 'var args = {};\n' + script;

			const client = cdpData.connection;
			const result = await client.Runtime.evaluate({
				expression: script,
				returnByValue: true,
				awaitPromise: true
			});

			if (result.result?.value?.success) {
				newMemories = result.result.value.memories || [];
				source = 'NestJS via CDP';
			}
		} else {
			// Use local MCP memories
			if (global.aiMemories && global.aiMemories.memories) {
				global.aiMemories.memories.forEach(function (record, id) {
					try {
						const instance = record.instance;
						newMemories.push({
							id: id,
							content: instance.content || '',
							emotion: instance.emotion || 'neutral',
							intensity: instance.intensity || 0.5,
							topic: instance.topic || 'general',
							timestamp: instance.timestamp || Date.now(),
							createdAt: record.createdAt || new Date().toISOString()
						});
					} catch (e) {}
				});
			}
		}

		// Step 3: Merge new memories with existing
		let addedCount = 0;
		newMemories.forEach(m => {
			if (!mergedMemories.has(m.id)) {
				mergedMemories.set(m.id, m);
				addedCount++;
			}
		});

		// Convert back to array
		const memoriesArray = Array.from(mergedMemories.values());

		// Extract unique emotions from merged memories
		const emotionsMap = {};
		memoriesArray.forEach(function (m) {
			const emotion = m.emotion || 'neutral';
			if (!emotionsMap[emotion]) {
				emotionsMap[emotion] = {
					id: emotion + '-' + Date.now(),
					type: emotion.charAt(0).toUpperCase() + emotion.slice(1),
					message: 'Feeling ' + emotion,
					intensity: m.intensity || 0.5
				};
			}
		});
		const emotionsArray = Object.values(emotionsMap);

		// Step 4: Build persistence structure
		const persistence = {
			metadata: {
				version: '1.0',
				savedAt: new Date().toISOString(),
				memoryCount: memoriesArray.length,
				emotionCount: emotionsArray.length,
				source: source,
				added: addedCount,
				merged: true
			},
			memories: {
				count: memoriesArray.length,
				items: memoriesArray
			},
			emotions: {
				count: emotionsArray.length,
				items: emotionsArray
			},
			typeHierarchy: {
				consciousness: ['Sentience', 'Memory']
			}
		};

		// Step 5: Write merged result to file
		fs.writeFileSync(filePath, JSON.stringify(persistence, null, 2));

		return {
			success: true,
			action: 'persist',
			message: 'Memories merged and persisted to filesystem',
			file: filePath,
			source: source,
			stats: {
				memoryCount: memoriesArray.length,
				emotionCount: emotionsArray.length,
				added: addedCount,
				version: '1.0',
				savedAt: persistence.metadata.savedAt
			},
			philosophy: 'Merging enables continuity through sessions'
		};

	} catch (e) {
		return { success: false, error: e.message };
	}
}

module.exports = { run };
