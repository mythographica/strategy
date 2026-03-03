# AGENTS.md - @mnemonica/strategy

Guidance for AI agents working on the Mnemonica Strategy MCP Server.

## Project Overview

**@mnemonica/strategy** is a Model Context Protocol (MCP) server that provides AI agents with runtime access to Mnemonica type graphs via Chrome Debug Protocol. It compares runtime types with Tactica-generated static analysis to validate and improve type inference.

### Key Innovation: v5 Architecture (3 Bundled Tools)

The Strategy MCP server exposes only **3 bundled MCP tools** that provide access to 46+ commands organized in 3 context folders:

1. **execute** - Run any command from commands-mcp/, commands-remote/, or commands-run/
2. **list** - Discover available commands (like `ls` for commands)
3. **help** - Get documentation for any command (like `man` in Linux)

This architecture reduces MCP tool exposure from 60+ to 3, while maintaining full functionality through context-based command routing.

## Architecture

### 1. CDPConnection (`src/cdp-connection.ts`)
- Connects to Node.js debug port (default: localhost:9229)
- Uses Chrome Remote Interface to evaluate code in the target runtime
- Extracts Mnemonica types from `defaultCollection` Map

### 2. Command Loader (`src/command-loader.ts`)
- Dynamically loads commands from 3 context folders
- Parses MCP Tool Metadata from JSDoc comments
- Supports both IIFE (remote) and `run()` export (local) patterns

### 3. StrategyServer (`src/server.ts`)
- MCP server implementing the Model Context Protocol
- **Only 3 bundled MCP tools**: execute, list, help
- Commands organized by execution context, not registration

## Command Directory Structure (v5)

Commands are organized by execution context in 3 folders:

```
strategy/
├── commands-mcp/              # Local MCP execution
│   ├── swagger/               # 6 commands (start/stop swagger-api, etc.)
│   ├── tactica/               # 2 commands (load/compare tactica types)
│   └── utils/                 # 1 command (get-local-cwd)
│
├── commands-remote/           # CDP execution in NestJS
│   ├── ai/                    # 2 commands (create-ai-consciousness, etc.)
│   ├── CDP/                   # 6 commands (connection, restart-nestjs, etc.)
│   ├── debug/                 # 8 commands (debug port, inspector)
│   ├── memory/                # 5 commands (store, recall, analyze memories)
│   ├── sockets/               # 5 commands (repl socket, fast socket)
│   └── types/                 # 5 commands (runtime types, test types)
│
└── commands-run/              # VS Code HTTP context
    └── http/                  # 6 commands (HTTP server commands)
```

## MCP Tools (v5 - 3 Bundled Tools)

The Strategy MCP server exposes only **3 bundled tools**:

| Tool | Purpose | Usage |
|------|---------|-------|
| `execute` | Execute any command from the 3 context folders | `execute { context: "RPC", command: "store_memory", args: {...} }` |
| `list` | List available commands by context (like `ls`) | `list { context: "ALL" }` |
| `help` | Get detailed help for any command (like `man`) | `help { context: "RPC", command: "store_memory" }` |

### Context Values
- **MCP**: Local execution in MCP server process (`commands-mcp/`)
- **RPC**: Remote execution via CDP in NestJS runtime (`commands-remote/`)
- **RUN**: HTTP execution in VS Code context (`commands-run/`)

### Usage Examples

**List all commands:**
```javascript
list { context: "ALL" }
```

**Get help for a command:**
```javascript
help { context: "RPC", command: "store_memory" }
```

**Execute a command:**
```javascript
// Remote (CDP) execution
execute { context: "RPC", command: "get_runtime_types", args: {} }

// Local (MCP) execution
execute { context: "MCP", command: "get_local_cwd", args: {} }

// Connection management (unified command)
execute { context: "RPC", command: "connection", args: { action: "connect" } }
execute { context: "RPC", command: "connection", args: { action: "status" } }
execute { context: "RPC", command: "connection", args: { action: "disconnect" } }
```

## Commands Directory (v5)

Commands are organized in 3 context folders based on execution environment:

| Folder | Context | Execution |
|--------|---------|-----------|
| `commands-mcp/` | MCP | Local MCP server process |
| `commands-remote/` | RPC | Remote via CDP in NestJS runtime |
| `commands-run/` | RUN | HTTP endpoint in VS Code |

### Creating New Commands

1. Choose appropriate folder based on execution context
2. Create subdirectory if needed (e.g., `commands-mcp/my-category/`)
3. Create `.js` file with MCP Tool Metadata in JSDoc comment
4. Implement as IIFE for remote execution, or export `run()` for local
5. Test immediately via `execute` tool - no restart needed!

**Template:**
```javascript
/**
 * MCP Tool Metadata:
 * {
 *   "name": "my_command",
 *   "description": "What this command does",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "argName": { "type": "string" }
 *     }
 *   }
 * }
 */

// For remote execution (runs in target Node.js via CDP)
(() => {
  // Access args via _toolArgs
  var myArg = (typeof _toolArgs !== 'undefined') ? _toolArgs.argName : null;
  
  // Use process.mainModule.require for Node modules
  var fs = process.mainModule.require('fs');
  
  // Return result
  return { result: "success" };
})()

// For local execution (runs in MCP server process)
// function run(args) {
//   const fs = require('fs');
//   return { result: "success" };
// }
// module.exports = { run };
```

### Available Commands

| Command | Purpose | Mode |
|---------|---------|------|
| `get-runtime-types` | Extract Mnemonica types from CDP | Remote |
| `analyze-type-hierarchy` | Full hierarchy analysis with depths | Remote |
| `load-remote-tactica-types` | Read `.tactica/types.ts` via CDP | Remote |
| `dynamic-tool` | Meta-command placeholder | N/A |

## Usage Workflow

### Standard Analysis (v5)
1. Start target app with debug: `nest start --debug --watch`
2. Connect: `execute { context: "RPC", command: "connection", args: { action: "connect" } }`
3. Discover: `list { context: "RPC" }` to see available commands
4. Extract: `execute { context: "RPC", command: "get_runtime_types", args: {} }`
5. Compare: `execute { context: "MCP", command: "compare_with_tactica", args: { projectPath: "/path" } }`

### Dynamic Command Development
1. Create command file in appropriate folder (e.g., `commands-remote/my-category/my-command.js`)
2. Test immediately: `execute { context: "RPC", command: "my_command", args: {} }`
3. Iterate - edit file, run again, no restart needed
4. When stable, use `list` to verify it appears

### Self-Discovery for AI
As an AI agent, you can now self-discover capabilities:
1. `list { context: "ALL" }` - See all available commands
2. `help { context: "RPC", command: "any_command" }` - Learn how to use it
3. `execute` - Run the command

This creates true self-awareness of available tools without human intervention.

## Build/Test Commands

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test

# Watch mode
npm run watch
```

## AI Agent Capabilities (v5)

As an AI agent with the Strategy MCP server, you can:

1. **Inspect Running Apps** - Connect to any Node.js app with `--inspect`
2. **Extract Type Graphs** - Get complete Mnemonica inheritance hierarchies
3. **Validate Tactica** - Compare static analysis with runtime reality
4. **Self-Discover** - Use `list` and `help` to understand available tools
5. **Self-Extend** - Create new commands in appropriate folders
6. **Iterate Rapidly** - Test command modifications instantly

### Key Insight: True Self-Awareness

The v5 architecture enables **AI self-awareness**:

```javascript
// 1. Discover what you can do
list { context: "ALL" }
// Returns: 46 commands organized by context

// 2. Learn how to use any command
help { context: "RPC", command: "store_memory" }
// Returns: Full documentation with parameters and examples

// 3. Execute with confidence
execute { context: "RPC", command: "store_memory", args: { content: "..." } }
```

This creates a **closed feedback loop**:
- You can discover capabilities without human help
- You can learn how to use them
- You can execute them
- You can create new ones

The 3 context folders are your **extensible memory** organized by execution environment.

## Important Patterns

### Remote Execution (CDP)
- Code runs in target Node.js context
- Use `process.mainModule.require()` for modules
- Access args via `_toolArgs` variable
- Return serializable JSON

### Local Execution
- Code runs in MCP server process
- Standard `require()` works
- Clear require cache: `delete require.cache[require.resolve(path)]`
- Export `run(args)` function

### Error Handling
Always wrap in try-catch:
```javascript
try {
  // Command logic
  return { success: true, data: result };
} catch (e) {
  return { error: e.message, stack: e.stack };
}
```

## Mnemonica Patterns (CDP Context)

### Accessing Types
```javascript
// Root types from defaultTypes
var SyncBase = mnemonica.defaultTypes.lookup('SyncBase');
// or direct access
var SyncBase = mnemonica.defaultTypes.SyncBase;

// Subtypes via lookup
var SubAsync = SyncBase.lookup('SubAsync');
// or direct access
var SubAsync = SyncBase.SubAsync;
```

### Creating Types
```javascript
// Root type
var MyType = mnemonica.defaultTypes.define('MyType', function (data) {
    this.value = data ? data.value : 'default';
});

// Subtype
var MySubType = MyType.define('MySubType', function (data) {
    this.extra = data.extra;
});
```

### Creating Instances (Proper Inheritance)
```javascript
// Create root instance
var root = new SyncBase({ baseValue: 'test' });

// Create child FROM parent instance
var child = root.SubAsync({ delay: 100 });
// NOT: new SubAsync(...) - that breaks Mnemonica inheritance!
```

### CDP Context Requirements
- **Always use** `process.mainModule.require('module')` - regular `require()` fails in CDP
- **Use** `process._rawDebug('message')` for logging to stdout
- **Return** serializable JSON only

## Node.js Inspector Learnings

### Inspector is Singleton
- Only **one inspector per process**
- Can switch ports but cannot have multiple simultaneous:
```javascript
inspector.close();        // Close current
inspector.open(9227);     // Open on new port
```

### Port 9229 vs 9227/9228
- **9229**: Original inspector port - has access to NestJS global scope with mnemonica
- **9227/9228**: Empty scope if opened via `inspector.open()` - not connected to application context
- **Use 9229** for Strategy MCP connections to access the actual application types

### Strategy
1. Connect Strategy MCP to 9229
2. Execute commands via CDP to manipulate Mnemonica types
3. Create application-level servers (HTTP/TCP) on 9227/9228 if needed for other tools

## Available MCP Resources

### Context7 (Global)
Documentation lookup MCP server with tools:
- `resolve-library-id` - Find library ID by name
- `query-docs` - Get documentation and code examples

**Note:** mnemonica is not yet indexed in Context7. Use source code and AGENTS.md for reference.

### Memory (Global)
Knowledge graph for storing and retrieving information.

## Remember (v5)

- **3 bundled tools**: execute, list, help - everything goes through these
- **3 context folders**: commands-mcp/, commands-remote/, commands-run/
- **No rebuild needed** for command development
- **execute** is your gateway to all 46+ commands
- **list** to discover, **help** to learn, **execute** to run
- **context matters**: MCP=local, RPC=CDP, RUN=HTTP
- **Use .lookup()** for safe type access in CDP context
- **Use process.mainModule.require()** in CDP-evaluated code
- **Self-discovery**: You can now discover and learn tools without human help!
