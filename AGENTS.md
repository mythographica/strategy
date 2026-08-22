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
  modules there via `process.mainModule.require('mnemonica')` (CJS targets;
  the ESM-safe prelude is Phase 2).
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
   - `ws_` — RESERVED for the Phase 3 WS-RPC layer; do not use yet
3. **No duplicated logic across invocation styles.** The old direct-name
   tools and `tool + script name` doublets are gone; the archive keeps the
   record.
4. **`commands-rpc/sockets/` is an experimental seed for Phase 3.** Its 5
   commands keep their legacy names and are exempt from the prefix rule
   until the WS protocol lands. Treat them as reference material, not as
   working commands.
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

commands-rpc/                     context: RPC (orchestrate CDP here)
  CDP/connection.js                      rpc_connection   (canonical; stores the cdp node)
  CDP/test.js                            rpc_test         (arg-echo smoke command)
  analyze-type-hierarchy.js              rpc_analyze_type_hierarchy  → cdp-scripts/analyze-hierarchy.js
  compare-graphs.js                      rpc_compare_graphs          → cdp-scripts/analyze-hierarchy.js + fixture /graph/json
  create-type.js                         rpc_create_type             → cdp-scripts/create-type.js
  say-hi-nestjs.js                       rpc_say_hi
  sockets/                               5 experimental seeds (Phase 3)

commands-run/                     context: RUN (local side effects)
  utils/update_agents_md.js              run_update_agents_md

cdp-scripts/                      payloads for Runtime.evaluate (NOT commands)
  analyze-hierarchy.js                   verified live 2026-08-22
  create-type.js
```

## Strategy's own architecture is mnemonica

Per the reframe constraint "Strategy should itself be built on mnemonica",
`src/strategy-types.ts` defines the server state as mnemonica types:

```
StrategyRuntime          root; one instance in the global store (StoreMeta)
├── CommandContext       built per execute() call; handed to commands as ctx
└── StrategyConnection   one per attached CDP target; stored as store['cdp']
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
npm test         # jest — 14 tests (6 legacy + 8 Phase 1 smoke); must stay green
```

Gates for any change: build clean, tests green, and for spine commands a
live smoke against a real runtime (the tactica-nestjs fixture + infer-debug
harness is the standard target; see `reports/audit-2026-08-22.md`).

## Dependency policy

Real pinned ranges, no `^0.x` placeholders. `mnemonica` is a peer
(`^1.2.7`) and a devDependency (for build/tests). Note the peer is about
API compatibility of the extraction scripts, not about sharing a process —
the target's mnemonica copy is always the one that matters at runtime.

## History

`DOCUMENTATION_INCONSISTENCIES.md` (2026-03) and `archive/` (2026-08) are
the record of how this got cleaned up. `commands-remote` was a symlink to
`commands-rpc` and was removed in Phase 1 — if old docs mention it, they
are stale.
