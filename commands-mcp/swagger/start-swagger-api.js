/**
 * MCP Tool Metadata:
 * {
 *   "name": "start_swagger_api",
 *   "description": "Start REST API server with Swagger UI for executing commands via HTTP endpoints",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "port": {
 *         "type": "number",
 *         "description": "Port to serve API (default: 8080)"
 *       }
 *     }
 *   }
 * }
 */

// Start REST API with Swagger UI
// Each command gets a POST endpoint: /api/commands/{command-name}
// Includes Swagger UI with "Try it out" functionality
// NOTE: No outer IIFE - server wraps this code with _toolArgs

try {
	var http = process.mainModule.require('http');
	var url = process.mainModule.require('url');
	var fs = process.mainModule.require('fs');
	var path = process.mainModule.require('path');

	var args = (typeof _toolArgs !== 'undefined') ? _toolArgs : {};
	var port = args.port || 8080;

	// Check if server already running on different port
	if (global.__swaggerApiServer) {
		// Close old server
		try {
			global.__swaggerApiServer.close();
			process._rawDebug('[Swagger API] Closed previous server instance');
		} catch (e) {
			// Ignore close errors
		}
		delete global.__swaggerApiServer;
	}

	// Load all commands
	var commandsDir = '/code/mnemonica/strategy/commands';
	var files = fs.readdirSync(commandsDir).filter(function (f) {
		return f.endsWith('.js');
	});

	var commands = {};
	files.forEach(function (file) {
		var filePath = path.join(commandsDir, file);
		var content = fs.readFileSync(filePath, 'utf-8');

		var metadataMatch = content.match(/\/\*\*\s*\n\s*\*\s*MCP Tool Metadata:\s*\n([\s\S]*?)\n\s*\*\//);

		if (metadataMatch) {
			try {
				var jsonStr = metadataMatch[1].replace(/^\s*\*\s?/gm, '');
				var metadata = JSON.parse(jsonStr);
				var routeName = file.replace('.js', '').replace(/-/g, '_');
				commands[routeName] = {
					name: metadata.name,
					description: metadata.description,
					inputSchema: metadata.inputSchema,
					file: file,
					route: '/api/commands/' + routeName
				};
			} catch (e) {
				// Skip invalid metadata
			}
		}
	});

	// Build OpenAPI spec
	var swaggerSpec = {
		openapi: '3.0.0',
		info: {
			title: 'Mnemonica Strategy MCP API',
			version: '1.0.0',
			description: 'REST API for executing MCP commands via HTTP. Each command has a POST endpoint.'
		},
		servers: [{ url: 'http://localhost:' + port }],
		tags: [
			{ name: 'Connection', description: 'Runtime connection commands' },
			{ name: 'AI Consciousness', description: 'AI emotional state commands' },
			{ name: 'Memory', description: 'Memory management commands' },
			{ name: 'Types', description: 'Type system commands' },
			{ name: 'System', description: 'System management commands' },
			{ name: 'Other', description: 'Other commands' }
		],
		paths: {}
	};

	// Helper to categorize commands
	function getCategory (desc) {
		desc = desc.toLowerCase();
		if (desc.includes('consciousness') || desc.includes('empathy') || desc.includes('emotion') || desc.includes('ai')) {
			return 'AI Consciousness';
		}
		if (desc.includes('memory')) {
			return 'Memory';
		}
		if (desc.includes('connect') || desc.includes('runtime') || desc.includes('cdp')) {
			return 'Connection';
		}
		if (desc.includes('type') || desc.includes('hierarchy') || desc.includes('instance')) {
			return 'Types';
		}
		if (desc.includes('restart') || desc.includes('swagger') || desc.includes('inspector') || desc.includes('socket')) {
			return 'System';
		}
		return 'Other';
	}

	Object.keys(commands).forEach(function (route) {
		var cmd = commands[route];
		swaggerSpec.paths[cmd.route] = {
			post: {
				summary: cmd.description,
				tags: [getCategory(cmd.description)],
				operationId: route,
				requestBody: {
					required: true,
					content: {
						'application/json': {
							schema: cmd.inputSchema || { type: 'object' }
						}
					}
				},
				responses: {
					'200': {
						description: 'Command executed successfully',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										success: { type: 'boolean' },
										result: { type: 'object' }
									}
								}
							}
						}
					},
					'400': {
						description: 'Invalid request',
						content: {
							'application/json': {
								schema: {
									type: 'object',
									properties: {
										error: { type: 'string' }
									}
								}
							}
						}
					}
				}
			}
		};
	});

	// Create HTTP server
	var server = http.createServer(function (req, res) {
		var parsedUrl = url.parse(req.url, true);
		var pathname = parsedUrl.pathname;

		// CORS headers
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

		if (req.method === 'OPTIONS') {
			res.writeHead(200);
			res.end();
			return;
		}

		// Swagger UI at root
		if (pathname === '/' || pathname === '/swagger') {
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end(getSwaggerUI(swaggerSpec));
			return;
		}

		// Swagger JSON spec
		if (pathname === '/swagger.json') {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(swaggerSpec, null, 2));
			return;
		}

		// Command execution endpoint
		if (pathname.startsWith('/api/commands/') && req.method === 'POST') {
			var route = pathname.replace('/api/commands/', '');
			if (commands[route]) {
				var body = '';
				req.on('data', function (chunk) {
					body += chunk;
				});
				req.on('end', function () {
					try {
						var params = body ? JSON.parse(body) : {};
						var commandFile = commands[route].file.replace('.js', '');

						// For now, return the command info and instructions
						// Full execution would require integration with MCP server
						res.writeHead(200, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({
							success: true,
							message: 'Command endpoint ready',
							command: {
								name: commands[route].name,
								file: commandFile,
								receivedParams: params
							},
							execution: {
								viaMCP: {
									tool: 'dynamic_tool',
									args: {
										commandName: commandFile,
										args: params,
										remote: false
									}
								},
								viaCDP: {
									tool: 'dynamic_tool',
									args: {
										commandName: commandFile,
										args: params,
										remote: true
									}
								}
							},
							note: 'To execute this command, use the MCP tool dynamic_tool with the args shown above'
						}, null, 2));
					} catch (e) {
						res.writeHead(400, { 'Content-Type': 'application/json' });
						res.end(JSON.stringify({ error: e.message }));
					}
				});
				return;
			} else {
				res.writeHead(404, { 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ error: 'Command not found: ' + route }));
				return;
			}
		}

		// Health check
		if (pathname === '/health') {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({
				status: 'healthy',
				commands: Object.keys(commands).length,
				uptime: process.uptime()
			}));
			return;
		}

		// 404
		res.writeHead(404, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ error: 'Not found', path: pathname }));
	});

	function getSwaggerUI (spec) {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Mnemonica Strategy MCP - Swagger UI</title>
	<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui.css" />
	<style>
		body { margin: 0; padding: 0; }
		.topbar { display: none; }
	</style>
</head>
<body>
	<div id="swagger-ui"></div>
	<script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-bundle.js"></script>
	<script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-standalone-preset.js"></script>
	<script>
		window.onload = function() {
			const ui = SwaggerUIBundle({
				spec: ${JSON.stringify(spec)},
				dom_id: '#swagger-ui',
				deepLinking: true,
				presets: [
					SwaggerUIBundle.presets.apis,
					SwaggerUIStandalonePreset
				],
				plugins: [
					SwaggerUIBundle.plugins.DownloadUrl
				],
				layout: 'StandaloneLayout',
				tryItOutEnabled: true,
				supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
				onComplete: function() {
					console.log('Swagger UI loaded successfully');
				}
			});
		};
	</script>
</body>
</html>`;
	}

	server.listen(port, function () {
		process._rawDebug('[Swagger API] Server running at http://localhost:' + port);
		process._rawDebug('[Swagger API] Swagger UI: http://localhost:' + port + '/swagger');
		process._rawDebug('[Swagger API] Swagger JSON: http://localhost:' + port + '/swagger.json');
	});

	// Store reference globally
	global.__swaggerApiServer = server;

	// Build endpoint list
	var endpointList = Object.keys(commands).map(function (k) {
		return {
			path: commands[k].route,
			method: 'POST',
			name: commands[k].name,
			description: commands[k].description
		};
	});

	return {
		success: true,
		message: 'Swagger REST API server started successfully',
		url: 'http://localhost:' + port,
		swaggerUI: 'http://localhost:' + port + '/swagger',
		swaggerJSON: 'http://localhost:' + port + '/swagger.json',
		healthCheck: 'http://localhost:' + port + '/health',
		stats: {
			totalCommands: Object.keys(commands).length,
			categories: ['Connection', 'AI Consciousness', 'Memory', 'Types', 'System', 'Other']
		},
		endpoints: endpointList,
		features: [
			'Full OpenAPI 3.0 specification',
			'Interactive Swagger UI with "Try It Out"',
			'POST endpoints for all commands',
			'CORS enabled for cross-origin requests',
			'Command categorization by function'
		]
	};

} catch (e) {
	return {
		success: false,
		error: e.message,
		stack: e.stack
	};
}
