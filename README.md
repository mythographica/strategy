# @mnemonica/strategy

MCP (Model Context Protocol) server that lets an AI agent **work on a running
Mnemonica runtime** — inspect its type tree, define new types, construct
instances, and swap constructor handlers in flight — without stopping the
server you are developing.

## Overview

Strategy is the live bridge between a running Mnemonica runtime and the
tools around it. It attaches to a target Node.js process via the Chrome
Debug Protocol (CDP) — zero instrumentation of the target — and then moves
the real work onto a fast WebSocket construction channel injected into the
process. It is designed as the central point: agents drive it over MCP
today; visualization tooling ([Mnemographica](https://github.com/mythographica))
is planned as a monitoring client — the bridge topology is decided
(Strategy standalone, Mnemographica as satellite) but the link itself is
**not implemented yet**.

The development loop this enables — the main server **never stops**:

1. Your app runs as usual (a debug-enabled child copy via
   [infer-debug](https://github.com/wentout/infer-debug) works too).
2. Strategy attaches over CDP — once. CDP is the delivery truck, not the road.
3. A dependency-free WebSocket server is injected into the runtime; all
   construction traffic (`define` / `instantiate` / `swap`) moves there.
4. New types are **born shimmed**: their constructor is a stable shell whose
   handler lives in the session's closure, so `ws_swap` can replace the
   implementation in flight — existing constructors and instances are
   untouched.
5. When a shape is proven, [Tactica](https://www.npmjs.com/package/@mnemonica/tactica)
   crystallizes it into `.tactica` type definitions.

Strategy can also compare the runtime type tree against Tactica-generated
types to validate static analysis — its original purpose, still available.

## Installation

```bash
npm install @mnemonica/strategy
```

From source instead:

```bash
git clone https://github.com/mythographica/strategy.git
cd strategy
npm install
npm run build
```

## Usage

### Prerequisites

Your target application must be running with the debug flag:

```bash
# For NestJS
nest start --debug --watch

# For regular Node.js
node --inspect=9229 your-app.js
```

Don't want `--inspect` on the main process? [infer-debug](https://github.com/wentout/infer-debug)
can spawn a debug-enabled child copy of the app on demand and tunnel CDP
through the app's own HTTP port — strategy attaches to that child the same
way.

### As MCP Server

```bash
# installed from npm
npx @mnemonica/strategy

# from a source checkout
node /path/to/strategy/lib/cli.js
```

### MCP Configuration

Add to your agent framework's MCP config:

```json
{
	"mcpServers": {
		"mnemonica-strategy": {
			"command": "npx",
			"args": ["-y", "@mnemonica/strategy"]
		}
	}
}
```

or, from a source checkout:

```json
{
	"mcpServers": {
		"mnemonica-strategy": {
			"command": "node",
			"args": ["/path/to/strategy/lib/cli.js"]
		}
	}
}
```

## MCP Tools Provided

The Strategy MCP server exposes **3 bundled tools**:

### 1. `execute`
Execute any command from the 3 context folders (MCP, RPC, RUN).

**Input:**
- `context` (string, required): Execution context - "MCP", "RPC", or "RUN"
- `command` (string, required): Command name to execute
- `message` (string, optional): JSON string containing command arguments

**Example:**
```javascript
// Connect to Node.js debugger
execute {
  context: "RPC",
  command: "rpc_connection",
  message: "{ \"action\": \"connect\", \"host\": \"localhost\", \"port\": 9229 }"
}

// Check connection status
execute {
  context: "RPC",
  command: "rpc_connection",
  message: "{ \"action\": \"status\" }"
}

// Analyze the runtime type hierarchy
execute {
  context: "RPC",
  command: "rpc_analyze_type_hierarchy",
  message: "{}"
}
```

### 2. `list`
List available commands by context.

**Input:**
- `context` (string, required): "MCP", "RPC", "RUN", or "ALL"

**Example:**
```javascript
list { context: "ALL" }
```

### 3. `help`
Get detailed help for any command.

**Input:**
- `context` (string, required): Command context
- `command` (string, required): Command name

**Example:**
```javascript
help { context: "RPC", command: "rpc_connection" }
```

## Args Passing Mechanism (IMPORTANT)

Due to MCP protocol limitations, command arguments must be passed as a **JSON string** in the `message` field, not as direct object properties.

**Correct format:**
```javascript
execute {
  context: "RPC",
  command: "rpc_connection",
  message: "{ \"action\": \"connect\", \"host\": \"localhost\", \"port\": 9229 }"
}
```

**Incorrect format (will not work):**
```javascript
// DON'T DO THIS
execute {
  context: "RPC",
  command: "rpc_connection",
  args: { action: "connect" }  // This won't work!
}
```

## Common Commands

### Connection Management

```javascript
// Connect to Node.js debugger
execute {
  context: "RPC",
  command: "rpc_connection",
  message: "{ \"action\": \"connect\", \"host\": \"localhost\", \"port\": 9229 }"
}

// Check connection status
execute {
  context: "RPC",
  command: "rpc_connection",
  message: "{ \"action\": \"status\" }"
}

// Disconnect from runtime
execute {
  context: "RPC",
  command: "rpc_connection",
  message: "{ \"action\": \"disconnect\" }"
}
```

### Type Analysis

```javascript
// Analyze the complete type hierarchy (recursive subtype tree from the target)
execute {
  context: "RPC",
  command: "rpc_analyze_type_hierarchy",
  message: "{}"
}

// Create type in the target runtime via CDP
execute {
  context: "RPC",
  command: "rpc_create_type",
  message: "{ \"typeName\": \"MyType\" }"
}

// Load Tactica-generated types
execute {
  context: "MCP",
  command: "mcp_load_remote_tactica_types",
  message: "{ \"projectPath\": \"/path/to/project\" }"
}

// Compare runtime vs Tactica types
execute {
  context: "MCP",
  command: "mcp_compare_with_tactica",
  message: "{ \"projectPath\": \"/path/to/project\" }"
}
```

## Example Workflow

1. Start your Mnemonica application with debug mode:
   ```bash
   # any Mnemonica app, e.g. a NestJS service
   nest start --debug --watch
   # or plain Node.js
   node --inspect=9229 your-app.js
   ```

2. Connect to the debugger:
   ```javascript
   execute {
     context: "RPC",
     command: "rpc_connection",
     message: "{ \"action\": \"connect\" }"
   }
   ```

3. Analyze runtime types:
   ```javascript
   execute {
     context: "RPC",
     command: "rpc_analyze_type_hierarchy",
     message: "{}"
   }
   ```

4. Compare with Tactica-generated types:
   ```javascript
   execute {
     context: "MCP",
     command: "mcp_compare_with_tactica",
     message: "{ \"projectPath\": \"/path/to/project\" }"
   }
   ```

## The construction channel (`ws_` commands)

After `rpc_connection` is up, one call injects the WS channel into the
target; everything after that is fast WS traffic, not CDP:

```javascript
// 1. Bootstrap: inject the WS server into the target (one CDP evaluate)
execute { context: "RPC", command: "ws_bootstrap", message: "{}" }

// 2. Define a type — born shimmed (swappable later)
execute {
  context: "MCP",
  command: "ws_define",
  message: "{ \"name\": \"TempProbe\", \"body\": \"function (data) { this.value = data.value; }\" }"
}

// 3. Construct an instance of it, right now, in the running process
execute {
  context: "MCP",
  command: "ws_instantiate",
  message: "{ \"path\": \"TempProbe\", \"args\": [{ \"value\": 42 }] }"
}
// → { chain: ["Mnemonica", "TempProbe"], props: { value: 42 } }

// 4. Swap the handler in flight — the constructor identity never changes
execute {
  context: "MCP",
  command: "ws_swap",
  message: "{ \"path\": \"TempProbe\", \"body\": \"function (data) { this.value = data.value * 2; }\" }"
}

// 5. Next instance uses the NEW implementation
execute {
  context: "MCP",
  command: "ws_instantiate",
  message: "{ \"path\": \"TempProbe\", \"args\": [{ \"value\": 42 }] }"
}
// → { props: { value: 84 } }

// Session state: which types are shimmed/swappable
execute { context: "MCP", command: "ws_session", message: "{ \"action\": \"list\" }" }
```

Rules the channel enforces (they are mnemonica semantics, not policy):

- `ws_swap` refuses any type not born via `ws_define` in this session —
  pre-existing types are never re-defined.
- Subtypes construct from parent **instances**: for nested paths,
  `ws_instantiate` walks the chain, taking intermediate constructor args
  from `chainArgs` (e.g. `{ "TempProbe": [{ "value": 7 }] }`).
- Async constructor handlers must `return this` (mnemonica enforces this).

The in-target server is development-only instrumentation: it binds
`127.0.0.1`, requires a per-session token at the WebSocket handshake, and
disappears with the process. Do not expose it on production runtimes.

## Command Contexts

| Context | Folder | Execution Environment |
|---------|--------|----------------------|
| MCP | `commands-mcp/` | Local MCP server process |
| RPC | `commands-rpc/` | Local orchestration; effects in the target via CDP |
| RUN | `commands-run/` | Local side effects (files, utilities) |

Command names carry their site as a prefix (`mcp_`, `rpc_`, `run_`), so
the place of execution is visible in the name itself. The `ws_` prefix
marks the construction channel: `ws_bootstrap` lives in `commands-rpc/`
(it needs CDP to get in), every other `ws_*` command lives in
`commands-mcp/` and talks to the stored WS session.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run watch

# Test
npm run test
```

## CDP Scripts Architecture

The `cdp-scripts/` folder contains scripts that execute inside the target Node.js runtime via Chrome Debug Protocol:

```
cdp-scripts/
├── create-type.js          # Creates mnemonica types in the target
├── analyze-hierarchy.js    # Retrieves complete type hierarchy
└── ws-server.js            # Phase 3: the injected WS construction server
```

**How it works:**
1. MCP command reads the script file
2. (create-type only) injects `var args = {...}` at the top with command arguments
3. Sends it to the target via `client.Runtime.evaluate({ expression: script, awaitPromise: true })`
4. Script executes inside the target process
5. Return value is sent back to the MCP process

**Key pattern — the canonical prelude.** Scripts must never use a bare
`require` (there is none in evaluated code) and never rely on
`process.mainModule.require` alone (it is `undefined` in ESM-entry
processes, and `import()` in evaluated code throws
`ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`). Every cdp-script loads the
target's own mnemonica through this exact three-tier prelude:

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

Scripts using it must be async IIFEs. `ws-server.js` generalizes the same
three tiers into a `targetRequire` factory because it also needs
`node:http`/`node:crypto` — see AGENTS.md for the variant rule.

```javascript
// Access types via the defaultCollection Map (avoids proxy enumeration issues)
mnemonica.defaultCollection.forEach(function (Type, name) {
    // Process each type
});

// Recursive traversal for subtype hierarchy
function getSubtypes (Type) {
    var subtypes = [];
    Type.subtypes.forEach(function (SubType, name) {
        subtypes.push({
            name: name,
            subtypes: getSubtypes(SubType)  // Recursive
        });
    });
    return subtypes;
}
```

## Creating Commands

Commands are JavaScript files in the `commands-*/` folders with MCP Tool Metadata.
Two shapes are supported; **`module.exports.run` is the pattern current
commands use**:

```javascript
/**
 * MCP Tool Metadata:
 * {
 *   "name": "mcp_my_command",
 *   "description": "What this command does",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "argName": { "type": "string" }
 *     }
 *   }
 * }
 */

async function run (ctx) {
  const { require, args, store } = ctx;

  // Parse message if present (args arrive as a JSON string in `message`)
  let commandArgs = args;
  if (args.message && typeof args.message === 'string') {
    try {
      commandArgs = JSON.parse(args.message);
    } catch (e) {
      return { success: false, error: 'Invalid JSON: ' + e.message };
    }
  }

  return { success: true, data: { got: commandArgs.argName } };
}

module.exports = { run };
```

Files without a `run` export are instead wrapped in an async IIFE with
`ctx` in scope. Two gotchas, both learned the hard way:

- **Never `ctx.require('mnemonica')`** — that resolves in the MCP process,
  not the target. Target-side mnemonica work belongs in `cdp-scripts/` with
  the canonical prelude.
- **`ctx.require` resolves relative paths from `lib/server.js`**, not from
  your command file — require lib modules by absolute path
  (`path.join(__dirname, '../../lib/...')`), the same idiom used for
  `cdp-scripts/`.

## License

MIT
