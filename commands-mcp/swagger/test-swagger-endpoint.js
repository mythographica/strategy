/**
 * MCP Tool Metadata:
 * {
 *   "name": "test_swagger_endpoint",
 *   "description": "Test a Swagger API endpoint via HTTP request using built-in http module",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "path": {
 *         "type": "string",
 *         "description": "API path to test (e.g., /health, /api/commands/analyze_memories)",
 *         "default": "/health"
 *       },
 *       "method": {
 *         "type": "string",
 *         "enum": ["GET", "POST"],
 *         "description": "HTTP method",
 *         "default": "GET"
 *       },
 *       "body": {
 *         "type": "object",
 *         "description": "Request body for POST requests"
 *       },
 *       "port": {
 *         "type": "number",
 *         "description": "Server port (default: 8080)",
 *         "default": 8080
 *       }
 *     }
 *   },
 *   "excludeFromMCP": true
 * }
 */

// Test Swagger API endpoints directly from MCP (no external curl needed)
// Makes HTTP request to localhost server and stores result in global

try {
	var http = process.mainModule.require('http');

	var args = (typeof _toolArgs !== 'undefined') ? _toolArgs : {};
	var path = args.path || '/health';
	var method = (args.method || 'GET').toUpperCase();
	var port = args.port || 8080;
	var body = args.body;

	// Initialize global storage
	if (!global.__mnemonicaStrategy) {
		global.__mnemonicaStrategy = {};
	}

	// Use synchronous pattern for MCP compatibility
	var result = {
		success: true,
		request: {
			url: 'http://localhost:' + port + path,
			method: method,
			body: body,
			timestamp: new Date().toISOString()
		},
		response: null,
		error: null
	};

	// Build request options
	var options = {
		hostname: 'localhost',
		port: port,
		path: path,
		method: method,
		headers: {
			'Content-Type': 'application/json'
		}
	};

	// Make synchronous-like request using blocking pattern
	var responseData = '';
	var statusCode = null;
	var requestError = null;

	var req = http.request(options, function (res) {
		statusCode = res.statusCode;

		res.on('data', function (chunk) {
			responseData += chunk;
		});

		res.on('end', function () {
			result.response = {
				statusCode: statusCode,
				data: responseData
			};
			global.__mnemonicaStrategy.lastTestResult = result;
			process._rawDebug('[Test Endpoint] ' + method + ' ' + path + ' -> ' + statusCode);
		});
	});

	req.on('error', function (err) {
		requestError = err;
		result.error = err.message;
		global.__mnemonicaStrategy.lastTestResult = result;
		process._rawDebug('[Test Endpoint] Error: ' + err.message);
	});

	// Send body if provided
	if (body && method === 'POST') {
		req.write(JSON.stringify(body));
	}

	req.end();

	return {
		success: true,
		message: 'HTTP request initiated',
		request: result.request,
		note: 'Request is asynchronous. Use get_last_test_result in 1-2 seconds to retrieve response.',
		storageKey: 'global.__mnemonicaStrategy.lastTestResult'
	};

} catch (e) {
	return {
		success: false,
		error: e.message,
		stack: e.stack
	};
}
