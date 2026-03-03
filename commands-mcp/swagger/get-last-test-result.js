/**
 * MCP Tool Metadata:
 * {
 *   "name": "get_last_test_result",
 *   "description": "Get the result of the last endpoint test from global storage",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "excludeFromMCP": true
 * }
 */

// Retrieve the last endpoint test result
// Used after calling test_swagger_endpoint to get the async response

try {
	var storage = global.__mnemonicaStrategy;

	if (storage && storage.lastTestResult) {
		var result = storage.lastTestResult;

		// Try to parse JSON response
		var parsedData = null;
		if (result.response && result.response.data) {
			try {
				parsedData = JSON.parse(result.response.data);
			} catch (e) {
				parsedData = result.response.data;
			}
		}

		return {
			success: true,
			hasResult: true,
			result: {
				request: result.request,
				response: parsedData ? {
					statusCode: result.response.statusCode,
					data: parsedData
				} : result.response,
				error: result.error
			},
			timestamp: result.request ? result.request.timestamp : 'unknown'
		};
	} else {
		return {
			success: true,
			hasResult: false,
			message: 'No test result available yet',
			note: 'Call test_swagger_endpoint first, wait 1-2 seconds, then call this command',
			hint: 'The test command initiates an async HTTP request'
		};
	}
} catch (e) {
	return {
		success: false,
		error: e.message
	};
}
