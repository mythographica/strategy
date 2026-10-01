# SKILL.md — Driving a running app with @mnemonica/strategy

Guidance for AI agents (and humans) using `@mnemonica/strategy` to
observe and steer a running mnemonica application. The full command
reference is the `help` MCP tool and [`README.md`](./README.md); this
file is the *how to think*.

## What this package is for

Strategy is the live bridge between a running mnemonica runtime and the
tools around it. It attaches to a target Node.js process over the Chrome
Debug Protocol (CDP) — zero instrumentation of the target — or connects
to a channel the app self-hosts, then moves construction traffic onto a
WebSocket channel injected into that process. Long-term goal: errored
trace → one click → debugger reproduction on real data.

Where the other packages fit (their SKILLs cover their side):

- [`@mnemonica/dive`'s SKILL](https://www.npmjs.com/package/@mnemonica/dive)
  — the wrap placement and context rules the traces you read here are
  built from.
- [`mnemonica`'s SKILL](https://www.npmjs.com/package/mnemonica) — the
  data model.
- [`@mnemonica/otel`'s SKILL](https://www.npmjs.com/package/@mnemonica/otel)
  — the engine that wired dive into the app you're inspecting.

## The 3-tool surface (deliberately fixed)

Exactly three MCP tools; everything is a command file under them:

1. `execute { context, command, message }` — runs a command file.
2. `list { context? }` — lists commands, grouped by context.
3. `help { context, command }` — metadata, schema, examples.

Arguments travel as a JSON string in `message`. Command names carry
their execution site by construction: `mcp_*` local, `rpc_*` orchestrates
CDP with effects in the target, `run_*` local side effects, `ws_*` the
construction channel. Never `ctx.require('mnemonica')` in a command —
that would load the WRONG process; in-target code lives in
`cdp-scripts/` and loads the target's own copies through the canonical
prelude.

## The everyday loop

1. **Connect** — `rpc_connection` to the target's inspector port (one per
   target; named slots exist).
2. **Bootstrap the channel** (once) — `ws_bootstrap` injects the
   dependency-free WebSocket server into the target; re-bootstrap is
   idempotent. It returns `{ port, token, pid }`; the token crosses the
   wire only here — WS clients present it as `?token=` or get a 401.
3. **Read the trace** — either:
   - `rpc_dive_trace` — polled snapshot: the target's RUNNING edges
     (`getRunningEdges`) + `stats` counters. This is the object-linked
     dive's enumerable surface: completed history collects by design;
     use the push channel for full flows.
   - `rpc_trace_push` — the push channel: the target's own dive hooks
     (enter/create via `traceSubscribe`) stream edges to mnemographica;
     leave/settle carry completions. No polling.
   - `rpc_trace_stream` — polled deltas for ambient illumination.
4. **Craft in flight** (development mode) — `ws_define`, `ws_swap`,
   `ws_instantiate`, `ws_eval`, `ws_session` over the channel:
   define/swap constructors in the live app with no restart. Swaps
   refuse types not born in the session. Async construct handlers MUST
   `return this`. Subtypes construct from parent INSTANCES — walk the
   chain; a bare `new LookupResult()` trips WRONG_MODIFICATION_PATTERN.
5. **App-side alternative** — an app can host the same channel with no
   CDP at all: `startStrategyClient(options?)` returns
   `{ port, token, pid, stop() }`; monitoring clients connect directly.

## Reading failures

The payoff path: `rpc_jaeger_trace` replays the latest dive-bearing
Jaeger trace into the 3D panel (Jaeger retains what the live trace no
longer holds; the dive.* tags survive the OTLP round-trip). For
crash-time data, dive's own contract applies — extract synchronously
inside the crash handler (`getFlow(error)` / `getErrorInstance(error)`);
see dive's SKILL.

## How strategy's own types are preserved (read before editing src/strategy-types.ts)

Strategy's mnemonica types live in `src/strategy-types.ts` and use
BUILDER MODE on the default collection: a `mnemonica.define(...)` chain
(`StrategyTypes`), children defined on the root constructor value, and
the exported API is the looked-up constructors — never the raw
`define()` results. Do NOT convert these exports back to free
`define()` results or add a hand-written `TypeRegistry` merge: the
free-export shape breaks TypeScript 6 declaration emit (TS2883, the
guard rail — see mnemonica docs/typed-lookup.md), and a hand-written
merge can drift from the handlers where the builder cannot.

## What you must NOT do

- Do not add MCP tools — the 3-tool surface is a design decision.
- Do not load mnemonica/dive in the MCP process (`ctx.require` is the
  MCP host's, not the target's) — in-target code goes in `cdp-scripts/`
  with the canonical prelude.
- Do not auto-wrap or instrument the target from strategy's side —
  dive's opt-in model stands; strategy observes what the app wrapped.
- Do not expose the WS channel off loopback — development instrument.

## Live development: changing a running app in flight

When the task is "the contract changed and the app must bend without a
redeploy", the loop is: **watch the secondary → read the scope → compile
locally → deliver through the channel → replay → report**. Mechanics are
in [README.md](./README.md) ("Live development on a running app"); the
mindset:

- Change the SECONDARY, never the main process. The main channel is an
  observer — a write op there is a policy violation, not a shortcut.
- `patch`/`rollback`/`patched` for mnemonica types (constructor identity
  is sacred; rollback is always one step away). `reload` for whole
  modules (compile ONE file locally with the app's tsconfig, send
  `{module, code}`). `liveEdit` only for shape-preserving one-function
  edits that must reach stale destructured bindings — and if V8 answers
  `BlockedByActiveGenerator`, a request is suspended in the old function:
  let it finish, then retry.
- Hooks belong to the file that registers them: a reload replaces exactly
  that file's hooks. Do not "fix" duplicates by hand — that hides journal
  drift.
- The entry module cannot be reloaded; if the fix IS the entry module,
  say so — that is a restart, owned by whoever deploys.
- Every captured scope and payload is production data. The regression
  test you build at the end comes from it; where that data may live is a
  team policy, not your call.

## Development-time notes

- The target's own `@mnemonica/dive` copy holds the state: a CJS
  `createRequire` reader sees the CJS flavor, an ESM-importing app the
  ESM flavor — the two are separate module instances. Prefer the
  self-hosted client (step 5) when the app is ESM.
