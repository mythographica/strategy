# North Star: one click from errored trace to debugger reproduction

> Status: DESIGN (2026-09-01). Nothing here is built yet except the pieces
> marked "exists". This is the agreed direction for Wanted.txt #5 → #6 —
> kept so the reasoning survives context compaction and memory gaps.

## The goal (Viktor's framing)

Watching a Live Trace row turn red should lead, in ONE click, to a debugger
session that re-produces that exact failure — the trace re-run as a
postmortem hit on real collected data, breakpoints pre-set at the lines the
trace already knows (the errored callsite, the define() site), on the real
request data that caused it.

Today we have the first half: the error is visible, red, and jumps to the
right line. The missing half is re-running with the same inputs.

## What exists

- **Trace collection with completions** — the push channel carries
  enter/create/leave/settle; errored traces are marked end-to-end
  (Live Trace row red, 3D sphere red).
- **The decision signal** — leave/settle edges carry `status: 'error'`.
  That IS the "this request failed" moment, known at runtime, per trace.
- **Code jumps** — every edge knows its callsite (file/line/column) and
  create edges know the define() site. A reproduction session could pre-set
  breakpoints at exactly those lines.
- **infer-debug** — spawns a debug-enabled child copy of the app and
  tunnels CDP through the app's own HTTP port. Already integrated in
  tactica-nestjs; already the answer to "no 9229 on a pod". A replayed
  request can be routed to the child while the main process serves
  everything else untouched.

## The missing piece: tail-based payload capture (Wanted #6 answer)

Storing every request body/header is impossible at volume — 1000 rps of
payloads is megabytes per second, and Jaeger cannot hold it. The way out
is **tail-based sampling** (the OTEL term; Sentry's breadcrumbs are the
same idea):

1. Keep a rolling in-memory ring of recent request payloads, keyed by
   traceId. Bounded by time AND bytes (e.g. last 30s, last 16 MiB).
2. When a trace closes clean — drop its payloads silently.
3. When a leave/settle edge reports `status: 'error'` — flush that trace's
   buffered payloads to durable storage (a file per trace, a small
   sqlite, anything queryable).
4. The Live Trace row / Jaeger span gets a `replay` link only when a
   captured payload exists for it.

Cost is bounded by the window, not by rps. The 100ms delayed-throw grenade
fits a tiny window easily; workflows whose error surfaces minutes later
need either a bigger window or explicit correlation config.

Capture policy is a design surface of its own: which headers (auth,
cookies), body size caps, PII redaction. This is why #6 stays open until
that policy is decided.

## The reproduction click (target flow)

1. User clicks an errored Live Trace row that has a captured payload.
2. Mnemographica asks infer-debug for a child (or reuses the idle one).
3. The stored request (method, path, headers, body) is replayed against
   the app; infer-debug routes it to the debug child.
4. Strategy (or Mnemographica directly, via the child CDP tunnel) sets
   breakpoints at the trace's callsite lines before the replay fires.
5. Execution pauses at the root-cause line — with the real failing data
   in scope.

## Honest limits

- Replay fidelity: downstream state (DB rows, caches, clocks) will not be
  what it was. The reproduction is a re-hit, not a time machine.
- Errors that depend on concurrency/timing may not reproduce on demand.
- Retention is a dev-stand feature; none of this belongs on a production
  pod without an explicit security review.

## Related

- `../reports/strategy-purpose-reframe-2026-09-01.md` — the Strategy
  reframe (app-side `.start()` client, log socket, direct app →
  Mnemographica stream).
- `../AGENTS.md` — WS channel, trace push, born-shimmed swap semantics.
- `/code/mnemonica/Wanted.txt` — #5/#6 (the origin of this document).
