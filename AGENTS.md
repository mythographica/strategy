# AGENTS.md - @mnemonica/strategy

Guidance for AI agents working on the Mnemonica Strategy MCP Server.

## What this is

**@mnemonica/strategy** is the live bridge between a running Mnemonica
runtime and the tools around it — the center of the topology star: agents
drive it over MCP; applications self-host its channel; visualization
tooling (Mnemographica) connects as a monitoring client. It attaches to a
target Node.js process via the Chrome Debug Protocol (CDP) — zero
instrumentation of the target — then moves construction traffic onto a
WebSocket channel injected into that process. Apps that may instrument
themselves can skip CDP entirely: see **The app-side client module**
below. The long-term UX goal (errored trace → one click → debugger
reproduction on real data) lives in [`docs/northstar.md`](./docs/northstar.md).
The development-mode side of the same channel (defining and swapping
constructors in a live app, no restart) is documented in
[`docs/live-craft.md`](./docs/live-craft.md).

## The 3-tool surface (do not expand without discussion)

The server exposes exactly **3 MCP tools** (`src/server.ts`):

1. **execute** — `{ context, command, message }` runs a command file.
2. **list** — `{ context? }` lists commands, grouped by context and folder.
3. **help** — `{ context, command }` returns metadata, schema, examples.

Arguments travel as a **JSON string in `message`**; every command parses
`args.message` first. This 3-tool design is deliberate and liked — do not
propose adding tools lightly.

## Execution model — the truth table

| Where code runs | How |
|---|---|
| **Strategy MCP process** (local) | `executeCommand` in `src/server.ts` runs EVERY command file locally: `module.exports.run` files via `require()`, all others via `new Function('ctx', body)`. There is no remote eval of command files. |
| **Target runtime** (remote) | Only code passed to `Runtime.evaluate()` over CDP runs in the target: (a) `CDPConnection.evaluate()` / `getMnemonicaTypes()`, (b) `cdp-scripts/*.js` payloads that RPC wrapper commands read from disk and send. |

Consequences:

- **NEVER `ctx.require('mnemonica')` in a command file.** `ctx.require` is the
  MCP process's require; mnemonica is a peer dependency and is not installed
  there, and even when resolvable it would touch the WRONG process.
- **`ctx.require` resolves relative paths from `lib/server.js`**, not from
  the command file — require lib modules by absolute path
  (`path.join(__dirname, '../../lib/...')`), the same idiom used for
  `cdp-scripts/`.
- Code meant for the target runtime belongs in `cdp-scripts/` and loads
  mnemonica there via the **canonical prelude** (below) — never a bare
  `require`, and never a bare `process.mainModule.require` without the
  fallback chain.

## The canonical prelude (mandatory in every cdp-script)

Every script evaluated in a target runtime loads the TARGET's mnemonica
exactly this way:

```javascript
var mnemonica;
if (process.mainModule && process.mainModule.require) {
	mnemonica = process.mainModule.require('mnemonica');
} else if (typeof process.getBuiltinModule === 'function') {
	var nodeModule = process.getBuiltinModule('node:module');
	var cwdRequire = nodeModule.createRequire(process.cwd() + '/__strategy_cwd__.js');
	mnemonica = cwdRequire('mnemonica');
} else {
	var mnemonicaNs = await import('mnemonica');
	mnemonica = mnemonicaNs.default || mnemonicaNs;
}
```

Why three tiers:

1. **CJS entries** have `process.mainModule` — the classic path.
2. **ESM entries** don't, and `Runtime.evaluate` gets **no dynamic-import
   callback** from Node, so `import()` throws
   `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` in inspector-evaluated code.
   Node ≥ 20.18 / 22.3 offers `process.getBuiltinModule('node:module')` →
   `createRequire`, which needs no callback.
3. Older runtimes fall back to dynamic `import()`.

Rules: copy the prelude verbatim (the scripts must stay self-contained
strings); any script using it must be wrapped in an **async** IIFE so the
tier-3 `await` is legal; `Runtime.evaluate` callers must keep
`awaitPromise: true`. Both cdp-scripts and `src/extract-types.js` use it;
`npm run build` copies extract-types into `lib/` automatically.

**Variant — require factory.** A script that needs more than mnemonica
(e.g. `cdp-scripts/ws-server.js` also needs `node:http`/`node:crypto`) MAY
generalize the same three tiers into a `targetRequire` factory and load
everything through it, mnemonica included. The tiers and their order are
unchanged; only the shape differs. Never a bare `require` in any case.

RPC-context commands are hybrid by design: orchestration locally
(`ctx.store.get('cdp')` for the connection), effect remotely
(`client.Runtime.evaluate(...)`).

## Command rules (codified, enforced by test)

1. **One command = one file = one declared execution site = one canonical
   name.** The declared name is the `"name"` in the file's `MCP Tool
   Metadata` JSDoc.
2. **Site prefixes make collisions impossible by construction:**
   - `mcp_` — runs locally, no CDP needed (tactica comparison, local utils)
   - `rpc_` — orchestrates a CDP connection, effects the target runtime
   - `run_` — local side effects (files, servers)
   - `ws_` — the construction channel: `ws_bootstrap` (RPC context) injects
     the WS server via CDP once; all other `ws_*` commands run locally
     against `store['ws']` and speak the WS protocol
3. **No duplicated logic across invocation styles.**
4. **`archive/` is frozen.** Never load, import, or "fix" files there; the
   loader only reads `commands-mcp/`, `commands-rpc/`, `commands-run/`.
   Prune targets go to `archive/`; deletion happens only on Viktor's
   explicit word.
5. **`test/phase1-smoke.test.ts` pins the command tree.** Adding, removing,
   or renaming a command means updating `EXPECTED` there — the suite fails
   otherwise. That failure is the review gate working as intended.

## Command tree

```
commands-mcp/                     context: MCP (local)
  tactica/compare-with-tactica.js        mcp_compare_with_tactica
  tactica/load-remote-tactica-types.js   mcp_load_remote_tactica_types
  utils/get-local-cwd.js                 mcp_get_local_cwd
  ws/define.js                           ws_define       → store['ws']
  ws/swap.js                             ws_swap         → store['ws']
  ws/instantiate.js                      ws_instantiate  → store['ws']
  ws/eval.js                             ws_eval         → store['ws']
  ws/session.js                          ws_session      → store['ws']

commands-rpc/                     context: RPC (orchestrate CDP here)
  CDP/connection.js                      rpc_connection   (canonical; stores the cdp node; named slots → store['cdp:<slot>'])
  analyze-type-hierarchy.js              rpc_analyze_type_hierarchy  → cdp-scripts/analyze-hierarchy.js
  compare-graphs.js                      rpc_compare_graphs          → cdp-scripts/analyze-hierarchy.js + fixture /graph/json
  create-type.js                         rpc_create_type             → cdp-scripts/create-type.js
  dive-trace.js                          rpc_dive_trace              → cdp-scripts/dive-trace.js
  jaeger-trace.js                        rpc_jaeger_trace postmortem replay: Jaeger spans → trace/ingest ('jaeger:<traceID>' session)
  trace-push.js                          rpc_trace_push  push channel: in-target dive hook events (default enter/create/leave/settle) → mnemographica trace/ingest; leave/settle re-publish edge ids as completions, consumers must upsert by id
  trace-stream.js                        rpc_trace_stream polled dive-trace deltas → trace/ingest (ambient illumination)
  eval.js                                rpc_eval                    generic Runtime.evaluate against any slot
  ws/bootstrap.js                        ws_bootstrap    → cdp-scripts/ws-server.js + lib/ws-session.js

commands-run/                     context: RUN (local side effects)
  utils/update_agents_md.js              run_update_agents_md

cdp-scripts/                      payloads for Runtime.evaluate (NOT commands)
  analyze-hierarchy.js
  create-type.js
  dive-trace.js                       JSON-safe dump of the target's dive trace
  ws-server.js                        in-target WS construction server;
                                      traceSubscribe bridges dive hook events to subscribers
                                      (default set enter/create/leave/settle — leave/settle
                                      carry edge completions: status + duration)
```

## The WS construction channel

Purpose: **runtime construction during active development**, not
observability. The full loop: main server never stops → infer-debug spawns
the sandbox child → CDP bootstraps the WS channel once → define/swap/
instantiate iterate over WS → tactica crystallizes the proven shape into
`.tactica` → the main server is re-framed in flight.

**Handshake.** `ws_bootstrap` (RPC context) reads `cdp-scripts/ws-server.js`
and evaluates it over CDP. The injected script starts a dependency-free
WebSocket server (RFC 6455 subset: `node:http` upgrade + `node:crypto` SHA1 +
a frame codec; nothing is installed into the target) bound to `127.0.0.1` on
an ephemeral port, mints a random token, and returns `{ port, token, pid }`.
That CDP result is the only time the token crosses a wire; WS clients present
it as `?token=` in the upgrade request or get a 401. Re-bootstrap is
idempotent (returns the running channel). Strategy's client is
`src/ws-session.ts` (`WSSession`, built on the `ws` package); the channel
handle lives in `store['ws']` as a mnemonica `WSChannel` node.

**Protocol.** One JSON message per WS frame: `{ id, op, params }` →
`{ id, ok, result | error: { message, stack } }`. `id` correlates
request/response. On connect the server sends a `welcome` frame (protocol
version, pid, mnemonica version, root type names). Ops: `ping`, `define`,
`swap`, `instantiate`, `eval`, `list`.

**Born-shimmed swap semantics.** Every type defined over WS is born shimmed:
mnemonica keeps a stable shell constructor whose `impl` lives in the
in-target server's closure, and the session registry (`Map`, full path →
`setImpl`) can reassign `impl` later. No core change — `runSetup` reads
`type.constructHandler` per construction, so the swap takes effect on the
next `new`. `swap` REFUSES any type not born in this session: no
re-definition of pre-existing types, ever (`define()` itself throws
`ALREADY_DECLARED`).

**mnemonica semantics the channel honors:**

- Subtypes construct from parent INSTANCES: `instantiate` on a nested path
  walks the chain (`new parentInstance.SubType(...)`), taking intermediate
  args from `chainArgs[prefixPath]`. A bare `new LookupResult()` trips
  `WRONG_MODIFICATION_PATTERN`.
- Async construct handlers MUST `return this` (`InstanceCreator.ts` enforces
  it with "seems async X has no return statement").
- Instance summaries walk the chain via `utils.parent` and merge own props
  leaf-first — own props of the leaf alone miss everything the parents built.

**Security posture.** Loopback bind + handshake token, development-only.
This is a construction instrument for dev machines — never expose it on a
production runtime.

## The app-side client module (self-hosted channel)

`src/client.ts` — `startStrategyClient(options?)` lets an APPLICATION host
the exact same WS channel with no CDP and no --inspect: the published
`cdp-scripts/ws-server.js` payload is evaluated in-process (single source
of truth — the CDP-injected path and the self-hosted path cannot diverge).
`options.port` pins the port (default ephemeral); the payload honors it
through `global.__strategyWSOptions`, which the CDP path never sets.
Returns `{ port, token, pid, alreadyRunning, stop() }`; the app decides how
to publish port+token (log line, control endpoint) so a monitor
(Mnemographica) can connect DIRECTLY with `WSSession.connect` and
`traceSubscribe` — Strategy then leaves the stream path entirely. This is
the `.start()` switch of the reframe: on at boot via config, or later on
demand. Exported from the package root together with `WSSession`.

## The log socket (spawned-mode observability)

`src/logger.ts` + `src/log-socket.ts`: logs always go to stderr (stdout is
the MCP protocol channel — never write logs there). When
`STRATEGY_LOG_PORT` is set, `StrategyServer.run()` additionally mirrors
every log line to a TCP socket on 127.0.0.1: whoever spawned the server
(Mnemographica, a human, an agent) connects with anything — netcat is a
valid consumer — and watches the logs without touching the protocol
stream.

## Strategy's own architecture is mnemonica

`src/strategy-types.ts` defines the server state as mnemonica types:

```
StrategyRuntime          root; one instance in the global store (StoreMeta)
├── CommandContext       built per execute() call; handed to commands as ctx
├── StrategyConnection   one per attached CDP target; stored as store['cdp']
└── WSChannel            one per bootstrapped WS channel; stored as store['ws']
```

- `StrategyServer` constructs the root and puts it in the global
  `StrategyMCP` Map under `Symbol.for('StrategyMCP.meta')`.
- `executeCommand` builds ctx as `new runtime.CommandContext(...)`; a
  plain-object fallback keeps pre-server usage working.
- `rpc_connection` stores `new runtime.StrategyConnection(host, port)` as
  `store['cdp']` — the shape (`{ connection, isConnected, host, port }`), so
  commands read it uniformly.
- Command files are plain JS; they only destructure props off these
  instances, which works through mnemonica's proxy layer.

## Trusted-code model

`executeCommand` evaluates command files with `new Function`. The command
folders are trusted local code by design — strategy is a development/debug
tool, not a sandbox. Do not accept command files from untrusted sources.

## Building and testing

```bash
npm run build    # tsc → lib/
npm test         # jest — must stay green
```

Gates for any change: build clean, tests green, and for spine commands a
live smoke against a real runtime (the tactica-nestjs fixture + infer-debug
harness is the standard target).

## tools/ — agent CDP drivers (canonical, NOT published)

Reusable harnesses for driving a VS Code extension-dev instance and the
trace channel over CDP/WS (moved out of /tmp 2026-08-30; /tmp copies are
disposable):

- `vsc-driver.js` — `ext '<expr>'` / `ui '<expr>'` / `shot file.png`
  against an instance launched with `--inspect-extensions=9233
  --remote-debugging-port=9223`
- `wv-eval.js` — eval inside the graph webview (reaches
  `__mnemographica3D` through the shim iframe)
- `hold-trace-stream.js` — connect CDP :9229 and hold rpc_trace_stream
  open (for watching the panel while edges flow)
- `state-probe.js` — mnemographica `state/query` readback (server | graph |
  trace | view | logs)
- `jaeger-v2.yaml` + `jaeger-ui.json` — the Jaeger all-in-one config and
  its UI link patterns: span tags `code.filepath` → `vscode://file/...`
  jumps, `dive.root_edge_id` / trace-level links →
  `vscode://mnemonica.mnemographica/trace?...` (Jaeger → Live Trace loop).
  Both files are mounted into the container by `bin/Jaegger-conf.sh`
  (`npm run jaegger:pre-configured`, idempotent restart)

## bin/ — starter scripts for complex commands

Multiline operational commands (docker runs with mounts, multi-step
harnesses) live as executable scripts in `bin/`, each wired to an npm
script in package.json so the entry point stays `npm run <name>`. First
occupant: `Jaegger-conf.sh` → `npm run jaegger:pre-configured`. `bin/` is
dev tooling and intentionally NOT in the published `files` list, same as
`tools/`.

The user-facing live demo (target + VS Code + stream) is
`mnemographica/scripts/live-demo.sh`. Traps (dconf holding devtools
ports, stale xvfb screenshots, recordCreation arg order) are documented
in `mnemographica/AGENTS.md` (headless-instance notes).

## Dependency policy

Real pinned ranges, no `^0.x` placeholders. `mnemonica` is a peer
(`^1.2.7`) and a devDependency (for build/tests). Note the peer is about
API compatibility of the extraction scripts, not about sharing a process —
the target's mnemonica copy is always the one that matters at runtime.
`ws` is a runtime dependency: the strategy-side WS client only; the
in-target server is dependency-free by design, so targets never need
anything installed for the channel to come up.

## Reports and memory hygiene

`reports/` files are the memory that survives context compaction — keep
them while they describe current or open state, delete them once fulfilled
or superseded (fix links that referenced them). This file must never carry
changelog or dated history — update sections in place, describe only the
present.
