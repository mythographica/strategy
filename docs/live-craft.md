# Live Craft — development mode over the WS channel

This document is the instruction for **live-craft mode**: defining and
replacing mnemonica constructors in a running application, on the flight,
without a restart.

## What this mode is for (and what it is NOT for)

Live craft exists for **development**: a human or an agent crafts a type and
**immediately sees** it — defines a constructor, constructs an instance,
looks at the result, replaces the constructor, constructs again. The running
server keeps all its state (registered types, live instances, trace history);
only the one constructor's behavior changes.

It is **not** part of the observability path. Tracing (`traceSubscribe`) is
passive observation and never touches the shim registry: no shim is ever
installed for a type that came from real source files. tactica-nestjs, for
example, is written fully ahead of time — its types carry no shims, and the
dive/Jaeger tracing of it does not route through this mechanism at all. The
shim exists only for types **born over the WS channel**, in that session.

Once a crafted shape proves out, **tactica crystallizes it into `.tactica`
files** — WS is the sketching surface, `.tactica` is the stone.

## The machinery, step by step (kept word by word)

**Which process gets the injection?** The *running app process itself* —
e.g. tactica-nestjs started with `--inspect=9229`. Nothing is ever injected
into strategy's MCP process or into mnemographica; those two only orchestrate
and observe. The injection is one CDP `Runtime.evaluate` call that loads the
`ws-server.js` payload into the app's own V8 context. Apps that may
instrument themselves skip even that: `startStrategyClient()` evaluates the
same payload in-process.

**What task is this solving?** Iterating on mnemonica type definitions in a
*live* server without restarting it. Restart is the enemy twice over: it's
slow, and it destroys all accumulated state (registered types, instances,
dive-trace history). So the channel lets you say "define a new type" or
"change that type's constructor" against the running process and immediately
construct instances to see what happens.

**Why WS at all — isn't CDP enough?** CDP is used exactly once, as a
*bootstrap*: it evaluates the payload that opens a WebSocket server inside
the app. After that, all traffic (define, swap, instantiate, trace
streaming) moves to that WS channel. CDP is a debugging protocol — chatty,
per-call overhead, and a debugger attach pauses/slows the debuggee; WS is a
dumb pipe the app itself owns, so `define` costs a plain JSON message and
trace events stream out without debugger semantics.

**Which new constructors?** When a client sends `define`, it sends the
construct handler as a **source string**. The payload compiles it in-app
with `new Function('return (' + body + ')')`. But mnemonica must not
register *that* function directly — otherwise it could never be replaced.
So the payload registers a **shim** instead:

```js
var shim = function () { return impl.apply(this, arguments); };
```

Mnemonica sees the shim as the constructHandler *forever* — constructor
identity, prototype chain, and `lookup()` results are bound to it. The real
code (`impl`) lives only in the injected server's closure, and a
`Map<fullPath, { setImpl }>` keeps a handle to swap it.

**What is `swap`?** Replacing `impl` for a type that was *born via WS in
that session*. Because mnemonica's `runSetup` reads `type.constructHandler`
fresh on every construction, the very next `new` executes the new code —
while the constructor object, the type graph, and all *existing* instances
stay intact. Two guards: swap refuses any type not born over WS (you can't
hot-patch types that came from real source files), and `instantiate` always
walks parent *instances* (`new parentInstance.SubType(...)`, never a bare
constructor) — the WRONG_MODIFICATION_PATTERN rule holds over the wire too.

## Where the shim can go next

The shim is a permanent shell around a replaceable `impl`. That shell buys
more than hot-patching during development:

- **Bootstrap-supplied impl** — a shim constructor may be kept as-is
  forever but receive its `impl` data on a bootstrap phase, or even from
  some **remote registry**. Paired with an async constructor, that is
  **remote-controlled construction**: the instance materializes only after
  the remote side supplies (or approves) the implementation.
- **In-the-middle-of-construction checks** — because the shim sits between
  `new` and the real handler, it can CHECK whether the args fit the impl
  before running it, for security reasons: crypto keys, credentials, and
  other values that must be verified *in the middle of construction*, where
  there is no other way to keep privacy (banks and the like). The check
  happens inside the construction phase itself — not before, not after.

These are directions, not built features; the point is that the shim is the
one place where all of them become possible without touching mnemonica core.

## Try it: the demo

With an app running its embedded strategy channel (e.g. tactica-nestjs with
`STRATEGY_CLIENT=1`):

```bash
cd strategy
DISCOVERY_URL=http://127.0.0.1:3100/strategy/channel npm run live-craft:demo
```

`bin/live-craft-demo.js` connects over WS (no CDP), defines a `LiveCraft`
type, instantiates it (impl A), **swaps the constructor on the flight**,
instantiates again (impl B), prints both instances and the swap count, and
proves the guard by trying — and failing — to swap a source-born type. If
the app also forwards dive events to Jaeger, both instantiations appear
there as separate traces: the replaced impl, visible after the fact.
