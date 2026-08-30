/**
 * MCP Tool Metadata:
 * {
 *   "name": "rpc_eval",
 *   "description": "Evaluate a JavaScript expression in an attached CDP target (Runtime.evaluate). The generic debugging eye: works against any connection slot — the fixture runtime, an --inspect-brk test process, or the VS Code extension host. Returns the JSON-safe value plus a debug trail.",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "expression": {
 *         "type": "string",
 *         "description": "JavaScript to evaluate in the target. Use an async IIFE for await."
 *       },
 *       "slot": {
 *         "type": "string",
 *         "description": "Connection slot to evaluate against (default: the main 'cdp' slot)."
 *       },
 *       "awaitPromise": {
 *         "type": "boolean",
 *         "description": "Await a returned promise (default: true)"
 *       }
 *     }
 *   },
 *   "examples": [
 *     {
 *       "description": "Read the target's process id and node version",
 *       "args": { "expression": "({ pid: process.pid, node: process.version })" }
 *     },
 *     {
 *       "description": "Inspect the mnemographica debug handle in the extension host",
 *       "args": { "slot": "ext", "expression": "globalThis.__mnemographica && globalThis.__mnemographica.ping()" }
 *     }
 *   ]
 * }
 */

async function run (ctx) {
	const debug = [];
	const store = ctx.store;
	const require = ctx.require;
	const args = ctx.args || {};

	let commandArgs = args;
	if (args.message && typeof args.message === 'string') {
		try {
			commandArgs = JSON.parse(args.message);
		} catch (e) {
			debug.push('failed to parse message: ' + e.message);
		}
	}

	const slot = commandArgs.slot || '';
	const storeKey = slot ? ('cdp:' + slot) : 'cdp';
	const expression = commandArgs.expression;
	const awaitPromise = commandArgs.awaitPromise !== false;
	debug.push('slot: ' + (slot || '(default)') + ' | awaitPromise: ' + awaitPromise);

	if (typeof expression !== 'string' || expression.length === 0) {
		return { success: false, error: 'expression is required', debug: debug };
	}

	const cdpData = (store && store instanceof Map) ? store.get(storeKey) : null;
	if (!cdpData || !cdpData.isConnected) {
		return { success: false, error: 'No CDP connection in slot: ' + (slot || 'cdp'), debug: debug };
	}

	try {
		const client = cdpData.connection;
		const evalResult = await client.Runtime.evaluate({
			expression     : expression,
			returnByValue  : true,
			awaitPromise   : awaitPromise,
		});

		if (evalResult.exceptionDetails) {
			const exception = evalResult.exceptionDetails.exception;
			debug.push('exception: ' + (exception && exception.description));
			return {
				success : false,
				error   : (exception && exception.description) || 'evaluation threw',
				debug   : debug,
			};
		}

		return {
			success    : true,
			executedIn : 'slot:' + (slot || 'cdp'),
			result     : evalResult.result ? evalResult.result.value : undefined,
			debug      : debug,
		};

	} catch (e) {
		debug.push('ERROR: ' + e.message);
		return { success: false, error: e.message, debug: debug };
	}
}

module.exports = { run };
