// This script is evaluated in the Node.js debug runtime via Runtime.evaluate
// (awaitPromise: true). It starts a dependency-free WebSocket server (RFC 6455
// subset) INSIDE the target process and returns { port, token, pid } to the
// bootstrapping party. After bootstrap, all construction traffic moves off CDP
// onto this channel; CDP is bootstrap-only.
//
// Protocol: one JSON message per WS frame.
//   → { id, op, params }
//   ← { id, ok: true, result } | { id, ok: false, error: { message, stack } }
// Auth: the session token must be presented as ?token=... during the WS
// handshake; it crosses the wire exactly once, as this script's CDP result.
//
// Ops: ping | define | swap | instantiate | eval | list | traceSubscribe | traceUnsubscribe
// Types defined here are BORN SHIMMED: mnemonica keeps a stable shell
// constructor whose `impl` lives in this script's closure; `swap` reassigns
// `impl`. Only session-born types are swappable — no re-definition of
// pre-existing types, ever.
//
// traceSubscribe turns the channel into a PUSH trace source: the script
// registers dive edge-lifecycle hooks (enter, and create where the target's
// dive supports it) and every subscribed socket receives unsolicited
// { op: 'trace', params: { edges } } frames, flushed on a short timer.
// Edges are mapped JSON-safe exactly like cdp-scripts/dive-trace.js.

(async () => {
	try {
		// Canonical prelude, generalized to a require factory: same three tiers
		// as every cdp-script (mainModule.require → getBuiltinModule +
		// createRequire → dynamic import last resort), but this script needs
		// node builtins too, not only mnemonica. Never a bare require.
		var targetRequire;
		if (process.mainModule && process.mainModule.require) {
			targetRequire = process.mainModule.require.bind(process.mainModule);
		} else if (typeof process.getBuiltinModule === 'function') {
			var nodeModule = process.getBuiltinModule('node:module');
			targetRequire = nodeModule.createRequire(process.cwd() + '/__strategy_cwd__.js');
		} else {
			var moduleNs = await import('node:module');
			var moduleBuiltin = moduleNs.default || moduleNs;
			targetRequire = moduleBuiltin.createRequire(process.cwd() + '/__strategy_cwd__.js');
		}

		var mnemonica = targetRequire('mnemonica');
		var http = targetRequire('http');
		var crypto = targetRequire('crypto');

		// Idempotent bootstrap: a second evaluate returns the running channel
		if (global.__strategyWS && global.__strategyWS.listening) {
			var running = global.__strategyWS;
			return {
				success: true,
				alreadyRunning: true,
				port: running.port,
				token: running.token,
				pid: process.pid,
			};
		}

		var token = crypto.randomBytes(24).toString('hex');
		// Session registry: full type path → swap handle. Lives in this
		// closure; dies with the process, exactly like the shim impls.
		var registry = new Map();

		var WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
		var MAX_MESSAGE = 16 * 1024 * 1024;

		function acceptKey (key) {
			var hash = crypto.createHash('sha1');
			hash.update(key + WS_GUID);
			return hash.digest('base64');
		}

		function encodeFrame (opcode, payload) {
			var header;
			var len = payload.length;
			if (len < 126) {
				header = Buffer.from([0x80 | opcode, len]);
			} else if (len < 65536) {
				header = Buffer.alloc(4);
				header[0] = 0x80 | opcode;
				header[1] = 126;
				header.writeUInt16BE(len, 2);
			} else {
				header = Buffer.alloc(10);
				header[0] = 0x80 | opcode;
				header[1] = 127;
				header.writeBigUInt64BE(BigInt(len), 2);
			}
			return Buffer.concat([header, payload]);
		}

		function encodeText (str) {
			return encodeFrame(0x1, Buffer.from(str, 'utf8'));
		}

		// Per-socket frame parser: handles masking, extended lengths,
		// fragmentation, ping/pong and close. Messages over MAX_MESSAGE or
		// unmasked client frames kill the connection.
		function makeFrameParser (onMessage, onClose, sendPong) {
			var buf = Buffer.alloc(0);
			var fragments = [];
			return function onData (chunk) {
				buf = Buffer.concat([buf, chunk]);
				while (true) {
					if (buf.length < 2) {
						return;
					}
					var b1 = buf[0];
					var b2 = buf[1];
					var fin = (b1 & 0x80) !== 0;
					var opcode = b1 & 0x0f;
					var masked = (b2 & 0x80) !== 0;
					var len = b2 & 0x7f;
					var offset = 2;
					if (len === 126) {
						if (buf.length < offset + 2) {
							return;
						}
						len = buf.readUInt16BE(offset);
						offset += 2;
					} else if (len === 127) {
						if (buf.length < offset + 8) {
							return;
						}
						var big = buf.readBigUInt64BE(offset);
						offset += 8;
						if (big > BigInt(MAX_MESSAGE)) {
							onClose();
							return;
						}
						len = Number(big);
					}
					if (len > MAX_MESSAGE) {
						onClose();
						return;
					}
					var maskKey = null;
					if (masked) {
						if (buf.length < offset + 4) {
							return;
						}
						maskKey = buf.slice(offset, offset + 4);
						offset += 4;
					}
					if (buf.length < offset + len) {
						return;
					}
					var payload = buf.slice(offset, offset + len);
					buf = buf.slice(offset + len);
					if (maskKey) {
						for (var i = 0; i < payload.length; i++) {
							payload[i] = payload[i] ^ maskKey[i % 4];
						}
					}
					if (opcode === 0x8) {
						onClose();
						return;
					}
					if (opcode === 0x9) {
						sendPong(payload);
						continue;
					}
					if (opcode === 0xA) {
						continue;
					}
					// 0x1 text, 0x0 continuation
					fragments.push(payload);
					if (fin) {
						var full = Buffer.concat(fragments);
						fragments = [];
						onMessage(full.toString('utf8'));
					}
				}
			};
		}

		// JSON-safe summarizer: depth-capped, circular-safe, functions become
		// name tags. mnemonica instances are summarized by their own
		// enumerable props — never serialized whole.
		function summarize (value, depth, seen) {
			seen = seen || [];
			if (value === null) {
				return null;
			}
			var t = typeof value;
			if (t === 'undefined') {
				return { __type: 'undefined' };
			}
			if (t === 'function') {
				return { __type: 'function', name: value.name || null };
			}
			if (t !== 'object') {
				return value;
			}
			if (seen.indexOf(value) >= 0) {
				return { __type: 'circular' };
			}
			if (depth >= 3) {
				return { __type: 'object', note: 'depth cap reached' };
			}
			seen.push(value);
			var out;
			if (Array.isArray(value)) {
				out = value.map(function (item) {
					return summarize(item, depth + 1, seen);
				});
			} else {
				out = {};
				var keys = Object.keys(value);
				for (var i = 0; i < keys.length; i++) {
					var k = keys[i];
					try {
						out[k] = summarize(value[k], depth + 1, seen);
					} catch (readErr) {
						out[k] = { __type: 'unreadable', error: String(readErr && readErr.message || readErr) };
					}
				}
			}
			seen.pop();
			return out;
		}

		// Instance summary for `instantiate`: own props of the LEAF alone miss
		// everything the parent chain constructed (mnemonica identity IS the
		// prototype chain). Walk up via utils.parent, merging own props
		// leaf-first, and record the constructor chain alongside.
		function summarizeInstance (inst) {
			var utils = mnemonica.utils || {};
			var props = {};
			var chain = [];
			var current = inst;
			var guard = 0;
			while (current && typeof current === 'object' && guard < 32) {
				guard++;
				try {
					var ctorName = current.constructor && current.constructor.name;
					chain.unshift(ctorName || '?');
				} catch (nameErr) {}
				var keys = Object.keys(current);
				for (var i = 0; i < keys.length; i++) {
					var k = keys[i];
					if (!(k in props)) {
						try {
							props[k] = summarize(current[k], 1);
						} catch (readErr) {
							props[k] = { __type: 'unreadable', error: String(readErr && readErr.message || readErr) };
						}
					}
				}
				var next = null;
				try {
					next = typeof utils.parent === 'function' ? utils.parent(current) : null;
				} catch (parentErr) {}
				if (!next || next === current) {
					break;
				}
				current = next;
			}
			return { chain: chain, props: props };
		}

		function compileHandler (body) {
			// body is the SOURCE of a function expression: classic, async,
			// or arrow. Compiled fresh each define/swap.
			var factory = new Function('return (' + body + '\n);');
			return factory();
		}

		function rootTypeNames () {
			try {
				var names = [];
				mnemonica.defaultCollection.forEach(function (Ctor, name) {
					names.push(name);
				});
				return names;
			} catch (e) {
				return [];
			}
		}

		function mnemonicaVersion () {
			try {
				var pkg = targetRequire('mnemonica/package.json');
				return pkg.version || null;
			} catch (e) {
				return null;
			}
		}

		function opDefine (params) {
			var name = params.name;
			var body = params.body;
			if (!name || typeof name !== 'string') {
				throw new Error('define: "name" (string) is required');
			}
			if (!body || typeof body !== 'string') {
				throw new Error('define: "body" (function source string) is required');
			}
			var parentPath = params.parentPath || null;
			var fullPath = parentPath ? parentPath + '.' + name : name;
			if (registry.has(fullPath)) {
				throw new Error('define: "' + fullPath + '" already defined in this session — use swap to change its handler');
			}

			var impl = compileHandler(body);
			// Born shimmed: mnemonica keeps THIS stable shell forever; swap
			// reassigns `impl` behind it. No core change — the shim lives in
			// this session's closure (Viktor's design, 2026-08-22).
			var shim = function () {
				return impl.apply(this, arguments);
			};

			var Ctor;
			if (parentPath) {
				var parent = mnemonica.lookup(parentPath);
				if (!parent) {
					throw new Error('define: parent type not found: "' + parentPath + '"');
				}
				Ctor = parent.define(name, shim, params.config || undefined);
			} else {
				Ctor = mnemonica.define(name, shim, params.config || undefined);
			}

			registry.set(fullPath, {
				path: fullPath,
				definedAt: Date.now(),
				swaps: 0,
				setImpl: function (newBody) {
					impl = compileHandler(newBody);
				},
			});

			return { path: fullPath, shimmed: true, constructor: typeof Ctor };
		}

		function opSwap (params) {
			var path = params.path;
			var body = params.body;
			if (!path) {
				throw new Error('swap: "path" is required');
			}
			if (!body || typeof body !== 'string') {
				throw new Error('swap: "body" (function source string) is required');
			}
			var entry = registry.get(path);
			if (!entry) {
				throw new Error(
					'swap: "' + path + '" is not swappable — only types born via ws define in this session can be swapped'
				);
			}
			entry.setImpl(body);
			entry.swaps += 1;
			entry.lastSwapAt = Date.now();
			return { path: path, swaps: entry.swaps };
		}

		async function opInstantiate (params) {
			var path = params.path;
			if (!path) {
				throw new Error('instantiate: "path" is required');
			}
			// Mnemonica semantics: subtypes are constructed from parent
			// INSTANCES (new parentInstance.SubType(...)), never from a bare
			// looked-up constructor — that trips "wrong modification pattern".
			// So a nested path walks the chain: each level is constructed from
			// the previous level's instance. Intermediate levels take their
			// args from chainArgs[prefixPath] (default []); the leaf takes args.
			var segments = path.split('.');
			var leafArgs = params.args || [];
			var chainArgs = params.chainArgs || {};

			var current = null;
			var currentPath = '';
			for (var i = 0; i < segments.length; i++) {
				currentPath = currentPath ? currentPath + '.' + segments[i] : segments[i];
				var isLeaf = i === segments.length - 1;
				var levelArgs = isLeaf ? leafArgs : (chainArgs[currentPath] || []);
				var Ctor;
				if (current === null) {
					Ctor = mnemonica.lookup(currentPath);
					if (!Ctor) {
						throw new Error('instantiate: type not found: "' + currentPath + '"');
					}
				} else {
					Ctor = current[segments[i]];
					if (typeof Ctor !== 'function') {
						throw new Error('instantiate: "' + currentPath + '" is not a subtype of the parent instance');
					}
				}
				// Async constructors yield thenable instances; awaiting a
				// plain instance is a pass-through.
				current = await new Ctor(...levelArgs);
			}
			return { path: path, instance: summarizeInstance(current) };
		}

		async function opEval (params) {
			var expression = params.expression;
			if (!expression || typeof expression !== 'string') {
				throw new Error('eval: "expression" (string) is required');
			}
			// Expression-only by design (v1): it is wrapped and awaited.
			// `mnemonica` and `registry` are in scope for the expression.
			var fn = new Function(
				'mnemonica',
				'registry',
				'return (async () => (' + expression + '\n))();'
			);
			var value = await fn(mnemonica, registry);
			return { value: summarize(value, 0) };
		}

		function opList () {
			var entries = [];
			registry.forEach(function (entry, path) {
				entries.push({
					path: path,
					definedAt: entry.definedAt,
					swaps: entry.swaps,
					lastSwapAt: entry.lastSwapAt || null,
				});
			});
			return {
				protocol: 1,
				pid: process.pid,
				shimmed: entries,
				rootTypes: rootTypeNames(),
			};
		}

		// --- Trace push subscription (B2) -----------------------------------
		// dive PUBLISHES edge lifecycle events; this bridges them onto the WS
		// channel as unsolicited notifications, so trace acquisition no longer
		// polls over CDP. Construction edges ride the opt-in 'create' event
		// (@mnemonica/dive >= 0.8.0); on older dive the channel still pushes
		// invocation edges via 'enter' and reports create as unsupported.
		// 'leave'/'settle' re-publish the SAME edge id with its completion
		// (status + duration) — subscribers must upsert by id, not append.
		var traceSubscribers = new Set();
		var traceBuffer = [];
		var TRACE_BUFFER_CAP = 5000;
		var traceFlushTimer = null;
		var traceHookDetach = [];
		var traceEventsActive = [];
		var diveTried = false;
		var diveModule = null;

		function loadDive () {
			if (!diveTried) {
				diveTried = true;
				try {
					diveModule = targetRequire('@mnemonica/dive');
				} catch (e) {
					diveModule = null;
				}
			}
			return diveModule;
		}

		var propsReaderTried = false;
		var propsReader = null;

		// Same instanceType resolution as cdp-scripts/dive-trace.js: the
		// edge's live instance cannot cross the wire, its mnemonica TypeName
		// is what the panel matches bulbs by.
		function instanceTypeOf (instance) {
			if (!propsReaderTried) {
				propsReaderTried = true;
				try {
					var mnemonicaModule = targetRequire('mnemonica/module');
					propsReader = mnemonicaModule.getProps || null;
				} catch (e) {
					propsReader = null;
				}
			}
			if (!instance || !propsReader) {
				return null;
			}
			try {
				var props = propsReader(instance);
				var type = props && props.__type__;
				return (type && type.TypeName) || null;
			} catch (e) {
				return null;
			}
		}

		function mapTraceEdge (edge) {
			// Wanted #2: the adapter publishes edgeId → OTEL traceId on a
			// global map (it owns the spans; we cannot see them here), so
			// mnemographica's Live Trace can offer the "Open in Jaeger" jump
			var traceIds = globalThis.__mnemonicaDiveTraceIds;
			var traceId = (traceIds && typeof traceIds.get === 'function')
				? (traceIds.get(edge.id) || null)
				: null;
			return {
				id: edge.id,
				parentId: edge.parentId,
				name: edge.name,
				kind: edge.kind,
				status: edge.status,
				duration: (edge.duration === undefined) ? null : edge.duration,
				ts: edge.ts,
				instanceType: instanceTypeOf(edge.instance),
				traceId: traceId,
			};
		}

		function flushTrace () {
			if (traceBuffer.length === 0) {
				return;
			}
			var batch = traceBuffer;
			traceBuffer = [];
			var notification = { op: 'trace', params: { edges: batch } };
			traceSubscribers.forEach(function (send) {
				send(notification);
			});
		}

		function stopTraceHooks () {
			if (traceFlushTimer) {
				clearInterval(traceFlushTimer);
				traceFlushTimer = null;
			}
			traceHookDetach.forEach(function (detach) {
				try {
					detach();
				} catch (e) {}
			});
			traceHookDetach = [];
			traceEventsActive = [];
			traceBuffer = [];
		}

		// A closed socket silently unsubscribes; the last one out tears the
		// hooks down so an unsubscribed channel costs the target nothing.
		function dropTraceSubscriber (send) {
			traceSubscribers.delete(send);
			if (traceSubscribers.size === 0) {
				stopTraceHooks();
			}
		}

		function opTraceSubscribe (params, send) {
			var dive = loadDive();
			if (!dive || typeof dive.registerHook !== 'function') {
				throw new Error('traceSubscribe: target runtime has no @mnemonica/dive registerHook — needs @mnemonica/dive >= 0.5.0');
			}
			if (traceSubscribers.has(send)) {
				return { subscribed: true, already: true, events: traceEventsActive.slice() };
			}

			var wanted = (params && Array.isArray(params.events) && params.events.length > 0)
				? params.events
				// enter/create alone leave every call edge 'running' forever —
				// leave/settle carry the completion (status + duration) and
				// surface errors, so they are in the default set
				: ['enter', 'create', 'leave', 'settle'];
			var unsupported = [];

			if (traceHookDetach.length === 0) {
				// First subscriber: attach the dive hooks. 'create' is probed —
				// a dive without it throws on registration, which we contain and
				// report instead of failing the subscription.
				wanted.forEach(function (event) {
					try {
						var detach = dive.registerHook(event, function (payload) {
							if (!payload || !payload.edge) {
								return;
							}
							if (traceBuffer.length >= TRACE_BUFFER_CAP) {
								traceBuffer.shift();
							}
							traceBuffer.push(mapTraceEdge(payload.edge));
						});
						traceHookDetach.push(detach);
						traceEventsActive.push(event);
					} catch (e) {
						unsupported.push(event);
					}
				});
				if (traceHookDetach.length === 0) {
					throw new Error('traceSubscribe: no requested events supported by the target dive (wanted: ' + wanted.join(', ') + ')');
				}
				var flushMs = (params && typeof params.flushMs === 'number' && params.flushMs >= 20)
					? params.flushMs
					: 150;
				traceFlushTimer = setInterval(flushTrace, flushMs);
			}

			traceSubscribers.add(send);
			var result = {
				subscribed: true,
				events: traceEventsActive.slice(),
			};
			if (unsupported.length > 0) {
				result.unsupported = unsupported;
			}
			return result;
		}

		function opTraceUnsubscribe (send) {
			dropTraceSubscriber(send);
			return { subscribed: false };
		}

		async function dispatch (msg, send) {
			var params = msg.params || {};
			switch (msg.op) {
			case 'ping':
				return { pong: true, timestamp: Date.now() };
			case 'define':
				return opDefine(params);
			case 'swap':
				return opSwap(params);
			case 'instantiate':
				return await opInstantiate(params);
			case 'eval':
				return await opEval(params);
			case 'list':
				return opList();
			case 'traceSubscribe':
				return opTraceSubscribe(params, send);
			case 'traceUnsubscribe':
				return opTraceUnsubscribe(send);
			default:
				throw new Error('unknown op: "' + msg.op + '"');
			}
		}

		function handleConnection (socket) {
			function send (obj) {
				try {
					socket.write(encodeText(JSON.stringify(obj)));
				} catch (writeErr) {}
			}

			send({
				op: 'welcome',
				protocol: 1,
				pid: process.pid,
				mnemonica: mnemonicaVersion(),
				rootTypes: rootTypeNames(),
			});

			var onData = makeFrameParser(
				function (text) {
					var msg;
					try {
						msg = JSON.parse(text);
					} catch (parseErr) {
						send({ id: null, ok: false, error: { message: 'bad JSON message' } });
						return;
					}
					dispatch(msg, send).then(function (result) {
						send({ id: msg.id, ok: true, result: result });
					}, function (err) {
						send({
							id: msg.id,
							ok: false,
							error: {
								message: String(err && err.message || err),
								stack: err && err.stack ? String(err.stack) : null,
							},
						});
					});
				},
				function () {
					try {
						socket.end();
					} catch (e) {}
				},
				function (payload) {
					try {
						socket.write(encodeFrame(0xA, payload));
					} catch (e) {}
				}
			);

			socket.on('data', onData);
			// Client errors must never take the target down
			socket.on('error', function () {});
			socket.on('close', function () {
				dropTraceSubscriber(send);
			});
		}

		var server = http.createServer();
		server.on('upgrade', function (req, socket) {
			try {
				var url = new URL(req.url, 'http://localhost');
				var key = req.headers['sec-websocket-key'];
				if (url.searchParams.get('token') !== token || !key) {
					socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
					socket.destroy();
					return;
				}
				socket.write(
					'HTTP/1.1 101 Switching Protocols\r\n' +
					'Upgrade: websocket\r\n' +
					'Connection: Upgrade\r\n' +
					'Sec-WebSocket-Accept: ' + acceptKey(key) + '\r\n\r\n'
				);
				handleConnection(socket);
			} catch (e) {
				try {
					socket.destroy();
				} catch (destroyErr) {}
			}
		});

		await new Promise(function (resolve, reject) {
			server.once('error', reject);
			// Self-hosted path (startStrategyClient) may pin the port via a
			// global; CDP injection never sets it and stays ephemeral.
			var opts = global.__strategyWSOptions || {};
			server.listen(opts.port || 0, '127.0.0.1', resolve);
		});
		var port = server.address().port;

		global.__strategyWS = {
			listening: true,
			server: server,
			token: token,
			port: port,
			registry: registry,
			startedAt: Date.now(),
		};

		return {
			success: true,
			alreadyRunning: false,
			port: port,
			token: token,
			pid: process.pid,
			protocol: 1,
			ops: ['ping', 'define', 'swap', 'instantiate', 'eval', 'list', 'traceSubscribe', 'traceUnsubscribe'],
		};
	} catch (e) {
		return { success: false, error: e.message, stack: e.stack };
	}
})()
