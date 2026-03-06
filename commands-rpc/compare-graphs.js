/**
 * MCP Tool Metadata:
 * {
 *   "name": "cdp_compare_graphs",
 *   "description": "Compare CDP-retrieved type hierarchy with API-based graph from NestJS",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   }
 * }
 */

async function run (ctx) {
	const store = ctx.store;
	const require = ctx.require;

	const cdpData = (store && store instanceof Map) ? store.get('cdp') : null;
	if (!cdpData || !cdpData.isConnected) {
		return { success: false, error: 'No CDP connection' };
	}

	try {
		const http = require('http');
		const fs = require('fs');
		const path = require('path');

		// Helper to fetch from API
		function fetchAPI () {
			return new Promise((resolve, reject) => {
				const req = http.get('http://localhost:3000/graph/json', (res) => {
					let data = '';
					res.on('data', chunk => data += chunk);
					res.on('end', () => {
						try {
							resolve(JSON.parse(data));
						} catch (e) {
							reject(new Error('Failed to parse API response: ' + e.message));
						}
					});
				});
				req.on('error', reject);
				req.setTimeout(5000, () => reject(new Error('API request timeout')));
			});
		}

		// Fetch CDP graph
		const scriptPath = path.join(__dirname, '../../cdp-scripts/analyze-hierarchy.js');
		let script = fs.readFileSync(scriptPath, 'utf-8');
		script = 'var args = {};\n' + script;

		const client = cdpData.connection;
		const cdpResult = await client.Runtime.evaluate({
			expression: script,
			returnByValue: true,
			awaitPromise: true
		});

		if (cdpResult.exceptionDetails) {
			return { success: false, error: 'CDP error: ' + cdpResult.exceptionDetails.exception?.description };
		}

		const cdpGraph = cdpResult.result?.value;

		// Fetch API graph
		const apiGraph = await fetchAPI();

		// Compare
		const comparison = {
			cdp: {
				typeCount: cdpGraph.typeCount,
				types: cdpGraph.collectionTypes || Object.keys(cdpGraph.hierarchy || {})
			},
			api: {
				typeCount: apiGraph.typeCount,
				types: Object.keys(apiGraph.hierarchy || {})
			},
			match: cdpGraph.typeCount === apiGraph.typeCount,
			cdpOnly: [],
			apiOnly: []
		};

		// Find differences
		const cdpTypes = new Set(comparison.cdp.types);
		const apiTypes = new Set(comparison.api.types);

		comparison.cdp.types.forEach(t => {
			if (!apiTypes.has(t)) comparison.cdpOnly.push(t);
		});

		comparison.api.types.forEach(t => {
			if (!cdpTypes.has(t)) comparison.apiOnly.push(t);
		});

		return {
			success: true,
			comparison: comparison,
			identical: comparison.match && comparison.cdpOnly.length === 0 && comparison.apiOnly.length === 0,
			cdpTimestamp: cdpGraph.timestamp,
			apiTimestamp: apiGraph.timestamp
		};

	} catch (e) {
		return { success: false, error: e.message };
	}
}

module.exports = { run };
