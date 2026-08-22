# AGENTS.md - @mnemonica/strategy

Guidance for AI agents working on the Mnemonica Strategy MCP Server.

> **Phase 1 rewrite (2026-08-22).** This file replaces the stale v5-era guide.
> The old text described 46+ commands, folders that no longer exist, and —
> critically — a wrong execution model. Everything below reflects the audited
> reality. See `reports/audit-2026-08-22.md` for the evidence and
> `reports/reframe-plan-2026-08-22.md` for where this is going.

## What this is

**@mnemonica/strategy** is the live bridge between a running Mnemonica
runtime and the tools that want to see it: AI agents via MCP, Mnemographica,
and eventually the Queue-4 3D graph. It attaches to a target Node.js process
via the Chrome Debug Protocol (CDP) and evaluates extraction scripts inside
that process. Zero instrumentation of the target.

## The 3-tool surface (do not expand without discussion)

The server exposes exactly **3 MCP tools** (`src/server.ts`):

1. **execute** — `{ context, command, message }` runs a command file.
2. **list** — `{ context? }` lists commands, grouped by context and folder.
3. **help** — `{ context, command }` returns metadata, schema, examples.

Arguments travel as a **JSON string in `message`**; every command parses
`args.message` first. This 3-tool design is deliberate and liked — do not
propose adding tools lightly.

## Execution model — the truth table

This is the section past sessions kept getting wrong. Read it twice.

| Where code runs | How |
|---|---|
| **Strategy MCP process** (local) | `executeCommand` in `src/server.ts` runs EVERY command file locally: `module.exports.run` files via `require()`, all others via `new Function('ctx', body)`. There is no remote eval of command files. |
| **Target runtime** (remote) | Only code passed to `Runtime.evaluate()` over CDP runs in the target: (a) `CDPConnection.evaluate()` / `getMnemonicaTypes()`, (b) `cdp-scripts/*.js` payloads that RPC wrapper commands read from disk and send. |

Consequences:

- **NEVER `ctx.require('mnemonica')` in a command file.** `ctx.require` is the
  MCP process's require; mnemonica is a peer dependency and is not installed
  there, and even when resolvable it would touch the WRONG process. 28
  command files died of this in the 2026-08-22 audit (see `archive/`).
- Code meant for the target runtime belongs in `cdp-scripts/` and loads
  mnemonica there via the **canonical prelude** (below) — never a bare
  `require`, and never a bare `process.mainModule.require` without the
  fallback chain.

## The canonical prelude (Phase 2, mandatory in every cdp-script)

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
   `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` in inspector-evaluated code
   (verified live 2026-08-22 against an ESM fixture). Node ≥ 20.18 / 22.3
   offers `process.getBuiltinModule('node:module')` → `createRequire`,
   which needs no callback.
3. Older runtimes fall back to dynamic `import()`.

Rules: copy the prelude verbatim (the scripts must stay self-contained
strings); any script using it must be wrapped in an **async** IIFE so the
tier-3 `await` is legal; `Runtime.evaluate` callers must keep
`awaitPromise: true`. Both surviving cdp-scripts and
`src/extract-types.js` use it; `npm run build` copies extract-types into
`lib/` automatically.

**Variant — require factory.** A script that needs more than mnemonica
(e.g. `cdp-scripts/ws-server.js` also needs `node:http`/`node:crypto`) MAY
generalize the same three tiers into a `targetRequire` factory and load
everything through it, mnemonica included. The tiers and their order are
unchanged; only the shape differs. Never a bare `require` in any case.
- RPC-context commands are hybrid by design: orchestration locally
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
   - `ws_` — the Phase 3 construction channel: `ws_bootstrap` (RPC context)
     injects the WS server via CDP once; all other `ws_*` commands run
     locally against `store['ws']` and speak the WS protocol
3. **No duplicated logic across invocation styles.** The old direct-name
   tools and `tool + script name` doublets are gone; the archive keeps the
   record.
4. **The `commands-rpc/sockets/` seeds are archived** at
   `archive/commands-rpc/sockets/` — superseded by the `ws_` layer. They
   remain useful reference material (REPL heritage from
   `/code/_dev/repl_sokets`), not working commands.
5. **`archive/` is frozen history.** Never load, import, or "fix" files
   there; the loader only reads `commands-mcp/`, `commands-rpc/`,
   `commands-run/`. Prune targets go to `archive/` (Viktor's standing
   decision; deletion happens only on his explicit word).
6. **`test/phase1-smoke.test.ts` pins the command tree.** Adding, removing,
   or renaming a command means updating `EXPECTED` there — the suite fails
   otherwise. That failure is the review gate working as intended.

## Current command tree (post-Phase-1)

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
  CDP/connection.js                      rpc_connection   (canonical; stores the cdp node)
  CDP/test.js                            rpc_test         (arg-echo smoke command)
  analyze-type-hierarchy.js              rpc_analyze_type_hierarchy  → cdp-scripts/analyze-hierarchy.js
  compare-graphs.js                      rpc_compare_graphs          → cdp-scripts/analyze-hierarchy.js + fixture /graph/json
  create-type.js                         rpc_create_type             → cdp-scripts/create-type.js
  say-hi-nestjs.js                       rpc_say_hi
  ws/bootstrap.js                        ws_bootstrap    → cdp-scripts/ws-server.js + lib/ws-session.js

commands-run/                     context: RUN (local side effects)
  utils/update_agents_md.js              run_update_agents_md

cdp-scripts/                      payloads for Runtime.evaluate (NOT commands)
  analyze-hierarchy.js                   verified live 2026-08-22
  create-type.js
  ws-server.js                           Phase 3: in-target WS construction server,
                                         verified live 2026-08-22 (17/17 direct + 9/9 MCP)
```

## The WS construction channel (Phase 3)

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

**Born-shimmed swap semantics (the design center, Viktor 2026-08-22).**
Every type defined over WS is born shimmed: mnemonica keeps a stable shell
constructor whose `impl` lives in the in-target server's closure, and the
session registry (`Map`, full path → `setImpl`) can reassign `impl` later.
No core change — `runSetup` reads `type.constructHandler` per construction,
so the swap takes effect on the next `new`. `swap` REFUSES any type not born
in this session: no re-definition of pre-existing types, ever (`define()`
itself throws `ALREADY_DECLARED`).

**mnemonica semantics the channel honors (learned live):**

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

## Strategy's own architecture is mnemonica

Per the reframe constraint "Strategy should itself be built on mnemonica",
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
  `store['cdp']` — the shape (`{ connection, isConnected, host, port }`) is
  unchanged, so existing commands read it identically.
- Command files are plain JS; they only destructure props off these
  instances, which works through mnemonica's proxy layer.

## Trusted-code model

`executeCommand` evaluates command files with `new Function`. The command
folders are trusted local code by design — strategy is a development/debug
tool, not a sandbox. Do not accept command files from untrusted sources.

## Building and testing

```bash
npm run build    # tsc → lib/
npm test         # jest — 16 tests (6 legacy + 10 Phase 1/3 smoke); must stay green
```

Gates for any change: build clean, tests green, and for spine commands a
live smoke against a real runtime (the tactica-nestjs fixture + infer-debug
harness is the standard target; see `reports/audit-2026-08-22.md`).

## Dependency policy

Real pinned ranges, no `^0.x` placeholders. `mnemonica` is a peer
(`^1.2.7`) and a devDependency (for build/tests). Note the peer is about
API compatibility of the extraction scripts, not about sharing a process —
the target's mnemonica copy is always the one that matters at runtime.
`ws` is a runtime dependency (Phase 3): the strategy-side WS client only;
the in-target server is dependency-free by design, so targets never need
anything installed for the channel to come up.

## History

`DOCUMENTATION_INCONSISTENCIES.md` (2026-03) and `archive/` (2026-08) are
the record of how this got cleaned up. `commands-remote` was a symlink to
`commands-rpc` and was removed in Phase 1 — if old docs mention it, they
are stale.
