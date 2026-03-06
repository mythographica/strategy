/**
 * MCP Tool Metadata:
 * {
 *   "name": "create_repl_socket_type",
 *   "description": "Create REPLSocketServer Mnemonica type for Unix domain socket REPL access",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {}
 *   },
 *   "excludeFromMCP": true
 * }
 */

// Create a Mnemonica type that starts a REPL socket server using Unix domain sockets
// Based on: /code/_dev/repl_sokets/repl_sockets.js

(() => {
	// Get ctx from the execution context
	var ctx = (typeof ctx !== 'undefined') ? ctx : {};
	var require = ctx.require || function(m) { return require(m); };
	var args = ctx.args || {};

	// Parse message if it exists
	if (args.message && typeof args.message === 'string') {
		try {
			var parsed = JSON.parse(args.message);
			args = parsed;
		} catch (e) {
			// keep original args
		}
	}

	try {
		// Use require for CDP context (now from ctx)
		var net = require('net');
		var fs = require('fs');
		var repl = require('repl');

		// Get Mnemonica from global or via require
		var mnemonica = global.mnemonica || require('mnemonica');
		var define = mnemonica.define;
		var defaultTypes = mnemonica.defaultTypes;

		// REPL socket server implementation
		var createREPLServer = function (socketPath, opts, cb) {
			// Remove existing socket file if present
			if (fs.existsSync(socketPath)) {
				fs.unlinkSync(socketPath);
			}

			var replServer = net.createServer(function (socket) {
				var r = repl.start({
					prompt: process.pid + ' mnemonica > ',
					input: socket,
					output: socket,
					terminal: false,
					useGlobal: true
				});

				// Inject context
				if (opts.context) {
					Object.keys(opts.context).forEach(function (name) {
						r.context[name] = opts.context[name];
					});
				}

				// Define custom commands
				if (opts.commands) {
					Object.keys(opts.commands).forEach(function (name) {
						try {
							r.defineCommand(name, opts.commands[name]);
						} catch (error) {
							process._rawDebug(error.stack || error);
						}
					});
				}

				r.on('exit', function () {
					socket.end();
				});

				if (typeof cb === 'function') {
					cb(socket, r);
				}
			});

			replServer.listen(socketPath);
			return replServer;
		};

		// Define REPLSocketServer type
		var REPLSocketServerType = define('REPLSocketServer', function (config) {
			this.socketPath = config && config.socketPath ? config.socketPath : '/tmp/mnemonica-repl.sock';
			this.server = null;
			this.running = false;
			this.connections = new Map();
			this.connectionId = 0;
		}, {
			strictMode: false
		});

		// Add start method
		REPLSocketServerType.prototype.start = function (context) {
			var self = this;
			return new Promise(function (resolve, reject) {
				if (self.running) {
					reject(new Error('REPL server already running at ' + self.socketPath));
					return;
				}

				// Default context includes mnemonica
				var defaultContext = {
					mnemonica: mnemonica,
					define: define,
					defaultTypes: defaultTypes,
					console: console
				};

				// Merge with provided context
				var finalContext = Object.assign({}, defaultContext, context);

				self.server = createREPLServer(self.socketPath, {
					context: finalContext,
					commands: {
						types: {
							help: 'List all Mnemonica types',
							action: function () {
								var types = [];
								if (defaultTypes && defaultTypes.subtypes) {
									defaultTypes.subtypes.forEach(function (Ctor, name) {
										types.push(name);
									});
								}
								this.outputStream.write('Types: ' + types.join(', ') + '\n');
								this.displayPrompt();
							}
						},
						stats: {
							help: 'Show REPL server statistics',
							action: function () {
								this.outputStream.write('Socket: ' + self.socketPath + '\n');
								this.outputStream.write('Running: ' + self.running + '\n');
								this.outputStream.write('Connections: ' + self.connections.size + '\n');
								this.displayPrompt();
							}
						}
					}
				}, function (socket, repl) {
					var id = ++self.connectionId;
					self.connections.set(id, { socket: socket, repl: repl });
					process._rawDebug('REPL client connected: ' + id);

					socket.on('close', function () {
						self.connections.delete(id);
						process._rawDebug('REPL client disconnected: ' + id);
					});
				});

				self.server.on('listening', function () {
					self.running = true;
					process._rawDebug('REPL Socket Server listening at: ' + self.socketPath);
					resolve({
						socketPath: self.socketPath,
						status: 'running',
						pid: process.pid
					});
				});

				self.server.on('error', function (err) {
					reject(err);
				});
			});
		};

		// Stop the server
		REPLSocketServerType.prototype.stop = function () {
			var self = this;
			return new Promise(function (resolve) {
				if (!self.running) {
					resolve({ status: 'not running' });
					return;
				}

				// Close all connections
				self.connections.forEach(function (conn) {
					conn.socket.end();
				});
				self.connections.clear();

				// Remove socket file
				try {
					if (fs.existsSync(self.socketPath)) {
						fs.unlinkSync(self.socketPath);
					}
				} catch (e) {}

				self.server.close(function () {
					self.running = false;
					process._rawDebug('REPL Socket Server stopped');
					resolve({ status: 'stopped' });
				});
			});
		};

		// Get server stats
		REPLSocketServerType.prototype.getStats = function () {
			return {
				running: this.running,
				socketPath: this.socketPath,
				connections: this.connections.size,
				pid: process.pid
			};
		};

		return {
			success: true,
			message: 'REPLSocketServer type created successfully (Unix domain socket)',
			type: 'REPLSocketServer',
			features: [
				'Node.js REPL',
				'Unix domain socket (file-based)',
				'Custom REPL commands (.types, .stats)',
				'Context injection (mnemonica, define, defaultTypes)'
			]
		};

	} catch (error) {
		return {
			success: false,
			error: error.message,
			stack: error.stack
		};
	}
})();
