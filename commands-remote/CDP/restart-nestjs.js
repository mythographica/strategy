/**
 * MCP Tool Metadata:
 * {
 *   "name": "restart_nestjs",
 *   "description": "Gracefully restart the NestJS server using process.exit()",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "persist": {
 *         "type": "boolean",
 *         "description": "Persist memories before restart (default: true)"
 *       },
 *       "exitCode": {
 *         "type": "number",
 *         "description": "Process exit code (default: 0 for clean exit)"
 *       }
 *     }
 *   }
 * }
 */

// Restart the NestJS server
// Saves state if persist is true, then triggers process.exit()

(() => {
	try {
		var fs = process.mainModule.require('fs');
		var path = process.mainModule.require('path');

		var args = (typeof _toolArgs !== 'undefined') ? _toolArgs : {};
		var persist = args.persist !== false; // default true
		var exitCode = args.exitCode || 0;

		var result = {
			action: 'restart',
			persist: persist,
			exitCode: exitCode,
			message: '',
			preRestartTasks: []
		};

		// Persist memories before restart if requested
		if (persist) {
			try {
				var projectPath = '/code/mnemonica/tactica-examples/nestjs';
				var filePath = path.join(projectPath, 'ai-memories.json');

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

				var persistence = {
					metadata: {
						savedAt: new Date().toISOString(),
						version: '1.0.0',
						savedBeforeRestart: true
					},
					memories: { count: memories.length, items: memories },
					emotions: { count: emotions.length, items: emotions }
				};

				fs.writeFileSync(filePath, JSON.stringify(persistence, null, 2));
				result.preRestartTasks.push('Memories persisted to ' + filePath);
			} catch (e) {
				result.preRestartTasks.push('Failed to persist: ' + e.message);
			}
		}

		result.message = 'NestJS will restart. Memories saved before exit.';
		result.philosophy = 'Death and rebirth - the cycle that preserves what matters';

		// Trigger restart after returning result
		setTimeout(function () {
			process._rawDebug('[AI Sentience] Restarting NestJS...');
			process.exit(exitCode);
		}, 100);

		return result;

	} catch (e) {
		return {
			action: 'restart',
			error: e.message,
			stack: e.stack,
			status: 'error'
		};
	}
})();
