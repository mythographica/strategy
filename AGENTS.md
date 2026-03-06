# AGENTS.md - @mnemonica/strategy

Guidance for AI agents working on the Mnemonica Strategy MCP Server.

## Project Overview

**@mnemonica/strategy** is a Model Context Protocol (MCP) server that provides AI agents with runtime access to Mnemonica type graphs via Chrome Debug Protocol. It compares runtime types with Tactica-generated static analysis to validate and improve type inference.

### Key Innovation: v5 Architecture (3 Bundled Tools)

The Strategy MCP server exposes only **3 bundled MCP tools** that provide access to 46+ commands organized in 3 context folders:

1. **execute** - Run any command from commands-mcp/, commands-rpc/, or commands-run/
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
│   ├── cdp/                   # NEW: CDP-based commands (create-type, analyze-hierarchy)
│   └── utils/                 # 1 command (get-local-cwd)
│
├── commands-rpc/           # RPC execution via direct CDP
│   ├── ai/                    # 2 commands (create-ai-consciousness, etc.)
│   ├── CDP/                   # 6 commands (connection, restart-nestjs, etc.)
│   ├── debug/                 # 8 commands (debug port, inspector)
│   ├── memory/                # 5 commands (store, recall, analyze memories)
│   ├── sockets/               # 5 commands (repl socket, fast socket)
│   └── types/                 # 5 commands (runtime types, test types)
│
├── commands-run/              # VS Code HTTP context
│   └── http/                  # 6 commands (HTTP server commands)
│
└── cdp-scripts/               # NEW: Scripts executed in NestJS via CDP
    ├── create-type.js         # Creates mnemonica types in NestJS
    └── analyze-hierarchy.js   # Retrieves complete type hierarchy
```

## CDP Scripts Architecture (New)

The `cdp-scripts/` folder contains JavaScript files that are executed **inside the target Node.js runtime** via Chrome Debug Protocol's `Runtime.evaluate()`:

### How CDP Scripts Work

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   MCP Server    │────▶│  CDP Connection  │────▶│   NestJS App    │
│  (commands-mcp) │     │ (Runtime.evaluate)│     │ (cdp-scripts/)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
       │                                                    │
       │                                                    ▼
       │                                            Console.log appears
       │                                            in NestJS terminal!
       │                                                    │
       └────────────────◄───────────────────────────────────┘
                    Return value via CDP
```

### Key Differences from RPC Commands

| Aspect | RPC Commands (commands-rpc/) | CDP Scripts (cdp-scripts/) |
|--------|----------------------------------|---------------------------|
| Execution | Direct CDP evaluate | Script file sent via CDP |
| Module access | `var { require } = ctx` | `process.mainModule.require()` |
| Context | Has access to ctx.store | Isolated VM context |
| Use case | Simple operations | Complex type analysis |

### Writing CDP Scripts

**Required pattern for requiring modules:**
```javascript
// CDP scripts run in isolated VM - use process.mainModule.require
var mnemonica = process.mainModule.require('mnemonica');
var fs = process.mainModule.require('fs');
```

**Accessing mnemonica types (avoid proxy issues):**
```javascript
// Get default collection
var defaultCollection = mnemonica.defaultTypes;

// Iterate subtypes Map (avoids proxy enumeration issues)
defaultCollection.subtypes.forEach(function (Type, name) {
    console.log('Found type:', name);
});

// Recursive subtype traversal
function getSubtypes (Type) {
    var subtypes = [];
    if (Type && Type.subtypes) {
        Type.subtypes.forEach(function (SubType, name) {
            subtypes.push({
                name: name,
                subtypes: getSubtypes(SubType)  // Recursive
            });
        });
    }
    return subtypes;
}
```

### Current CDP Scripts

| Script | Purpose | MCP Command |
|--------|---------|-------------|
| `create-type.js` | Creates mnemonica types in NestJS | `cdp_create_type` |
| `analyze-hierarchy.js` | Retrieves complete type hierarchy | `cdp_analyze_type_hierarchy` |

## MCP Tools (v5 - 3 Bundled Tools)

The Strategy MCP server exposes only **3 bundled tools**:

| Tool | Purpose | Usage |
|------|---------|-------|
| `execute` | Execute any command from the 3 context folders | `execute { context: "RPC", command: "store_memory", message: "{...}" }` |
| `list` | List available commands by context (like `ls`) | `list { context: "ALL" }` |
| `help` | Get detailed help for any command (like `man`) | `help { context: "RPC", command: "store_memory" }` |

### Context Values
- **MCP**: Local execution in MCP server process (`commands-mcp/`)
- **RPC**: Remote execution via CDP in NestJS runtime (`commands-rpc/`)
- **RUN**: HTTP execution in VS Code context (`commands-run/`)

### Args Passing Mechanism (IMPORTANT)

Due to MCP protocol limitations, command arguments must be passed as a **JSON string** in the `message` field, not as direct object properties.

**Correct format:**
```javascript
execute { 
  context: "RPC", 
  command: "connection", 
  message: "{ \"action\": \"connect\", \"host\": \"localhost\", \"port\": 9229 }"
}
```

**Inside commands, parse message as JSON:**
```javascript
var commandArgs = args;
if (args.message && typeof args.message === 'string') {
  try {
    commandArgs = JSON.parse(args.message);
  } catch (e) {
    // handle parse error
  }
}

var action = commandArgs.action;
var host = commandArgs.host || 'localhost';
var port = commandArgs.port || 9229;
```

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
// Remote (CDP) execution - connect to NestJS debugger
execute { 
  context: "RPC", 
  command: "connection", 
  message: "{ \"action\": \"connect\", \"host\": \"localhost\", \"port\": 9229 }"
}

// Check connection status
execute { 
  context: "RPC", 
  command: "connection", 
  message: "{ \"action\": \"status\" }"
}

// Disconnect from runtime
execute { 
  context: "RPC", 
  command: "connection", 
  message: "{ \"action\": \"disconnect\" }"
}

// Get runtime types from connected NestJS
execute { 
  context: "RPC", 
  command: "get_runtime_types", 
  message: "{}"
}

// Local (MCP) execution
execute { 
  context: "MCP", 
  command: "get_local_cwd", 
  message: "{}"
}
```

## Commands Directory (v5)

Commands are organized in 3 context folders based on execution environment:

| Folder | Context | Execution |
|--------|---------|-----------|
| `commands-mcp/` | MCP | Local MCP server process |
| `commands-rpc/` | RPC | Remote via CDP in NestJS runtime |
| `commands-run/` | RUN | HTTP endpoint in VS Code |

### Creating New Commands

1. Choose appropriate folder based on execution context
2. Create subdirectory if needed (e.g., `commands-mcp/my-category/`)
3. Create `.js` file with MCP Tool Metadata in JSDoc comment
4. Implement to handle `args.message` parsing for parameters
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

// Parse message if present (standard pattern for all commands)
var { require, args, store } = ctx;
var commandArgs = args;
if (args.message && typeof args.message === 'string') {
  try {
    commandArgs = JSON.parse(args.message);
  } catch (e) {
    return { success: false, error: 'Invalid JSON in message: ' + e.message };
  }
}

// Access parsed arguments
var myArg = commandArgs.argName;

// For remote execution - use process.mainModule.require for Node modules
var fs = process.mainModule.require('fs');

// Return result
return { success: true, result: "success" };
```

## Standard Analysis (v5)

### Type Introspection via CDP Scripts (New)

```javascript
// Create type in NestJS via CDP (uses cdp-scripts/create-type.js)
execute {
  context: "MCP",
  command: "cdp_create_type",
  message: "{ \"typeName\": \"MyType\" }"
}

// Analyze complete type hierarchy via CDP (uses cdp-scripts/analyze-hierarchy.js)
execute {
  context: "MCP",
  command: "cdp_analyze_type_hierarchy",
  message: "{}"
}
// Returns: { hierarchy: { UserEntity: {...}, ...}, typeCount: 4, ... }
```

### Type Introspection via RPC Commands

```javascript
// Get all Mnemonica types from connected runtime
execute { context: "RPC", command: "get_runtime_types", message: "{}" }

// Analyze type hierarchy (RPC version)
execute { context: "RPC", command: "analyze_type_hierarchy", message: "{}" }

// Compare with Tactica-generated types
execute { context: "MCP", command: "load_remote_tactica_types", message: "{ \"projectPath\": \"/path/to/project\" }" }
```

### Memory Management
```javascript
// Store memory in connected runtime
execute { 
  context: "RPC", 
  command: "store_memory", 
  message: "{ \"key\": \"myKey\", \"data\": {...} }"
}

// Recall memories
execute { context: "RPC", command: "recall_memories", message: "{ \"key\": \"myKey\" }" }

// Analyze memory patterns
execute { context: "RPC", command: "analyze_memories", message: "{}" }
```

### Connection Management
```javascript
// Connect to NestJS debugger
execute { 
  context: "RPC", 
  command: "connection", 
  message: "{ \"action\": \"connect\", \"host\": \"localhost\", \"port\": 9229 }"
}

// Check status
execute { context: "RPC", command: "connection", message: "{ \"action\": \"status\" }" }

// Disconnect
execute { context: "RPC", command: "connection", message: "{ \"action\": \"disconnect\" }" }
```

## Dynamic Command Development

One of the key benefits of v5 architecture is **dynamic command development**:

1. Create a new `.js` file in appropriate `commands-*/` folder
2. Add MCP Tool Metadata in JSDoc comment
3. Implement command logic
4. Test immediately with `execute` tool
5. No MCP server restart required!

Commands are discovered dynamically on each `execute` call by the command loader.

## Self-Discovery for AI

AI agents can discover available commands dynamically:

```javascript
// List all available commands
list { context: "ALL" }

// Get detailed help for any command
help { context: "RPC", command: "store_memory" }
help { context: "MCP", command: "generate_swagger" }

// Execute discovered commands
execute { context: "RPC", command: "<discovered_command>", message: "{...}" }
```

## Error Handling

Commands should return consistent error format:

```javascript
return {
  success: false,
  error: "Human-readable error message",
  debug: debug  // Optional debug trace array
};
```

Success format:

```javascript
return {
  success: true,
  data: { ... },  // Command-specific result data
  debug: debug   // Optional debug trace array
};
```

## Context Requirements

### MCP Context (commands-mcp/)
- Runs in MCP server process
- Can access local filesystem
- Can spawn child processes
- Cannot access CDP connection

### RPC Context (commands-rpc/)
- Runs in target Node.js runtime via CDP
- Can access runtime state (variables, functions, types)
- Uses `process.mainModule.require` for Node modules
- Requires active CDP connection

### RUN Context (commands-run/)
- Runs in VS Code extension host
- Can access VS Code API
- HTTP endpoint for browser-based tools

## Testing Commands

**Test command created for debugging:**
```javascript
// File: commands-rpc/CDP/test.js
// Use this to verify args passing is working

execute { 
  context: "RPC", 
  command: "test", 
  message: "{ \"action\": \"test\", \"host\": \"localhost\", \"port\": 5555 }"
}
```

Returns the third argument (port) to verify args are parsed correctly.

## AI Agent Capabilities (v5)

### Key Insight: True Self-Awareness

The stored arguments in the prototype chain allow AI to introspect and learn from its own execution history:

1. **Structure thinking** through explicit constructor chains
2. **Self-extend** by defining new features via `define()` calls
3. **Analyze behavior** through stored invocation arguments
4. **Become more capable** by understanding the inheritance graph

### Remote Execution (CDP)

Execute code in the target NestJS runtime:
```javascript
execute { context: "RPC", command: "<command>", message: "{...}" }
```

### Local Execution

Execute code in the MCP server process:
```javascript
execute { context: "MCP", command: "<command>", message: "{...}" }
```

### Accessing Types

```javascript
// Get all types from runtime
execute { context: "RPC", command: "get_runtime_types", message: "{}" }

// Load Tactica-generated types
execute { context: "MCP", command: "load_remote_tactica_types", message: "{ \"projectPath\": \"...\" }" }

// Compare runtime vs static
execute { context: "MCP", command: "compare_with_tactica", message: "{ \"projectPath\": \"...\" }" }
```

### Creating Types

```javascript
// Create test type in runtime
execute { context: "RPC", command: "create_test_type", message: "{ \"typeName\": \"MyType\" }" }

// Create instances
execute { context: "RPC", command: "create_test_instances", message: "{}" }
```

## Important Notes

### Inspector is Singleton

Node.js inspector can only be active on one port at a time. If you need to switch ports:

```javascript
execute { context: "RPC", command: "switch_inspector_port", message: "{ \"port\": 9228 }" }
```

### Port 9229 vs 9227/9228

- **9229**: Default Node.js inspector port
- **9228**: Alternative port for secondary inspection
- **9009**: Additional debug port option

### Strategy

Use the Strategy MCP server to:
1. Connect to running Node.js applications
2. Extract and analyze Mnemonica type hierarchies
3. Compare runtime types with Tactica-generated static analysis
4. Validate type inference accuracy
5. Improve AI understanding of JavaScript prototype chains

## Remember (v5)

1. **Only 3 MCP tools**: execute, list, help
2. **Args via `message`**: Pass arguments as JSON string in message field
3. **Parse in commands**: Always parse `args.message` as JSON
4. **Dynamic discovery**: Commands are loaded dynamically, no restart needed
5. **Context matters**: Choose correct folder (MCP/RPC/RUN) for execution context
6. **Test command**: Use `commands-rpc/CDP/test.js` to debug args passing


## 3-Tier Memory Architecture

**Updated**: 2026-03-05T08:46:44Z

Successfully implemented 3-tier command architecture:
- MCP (orchestration): Tries RPC, falls back to RUN
- RPC (remote): Pure CDP execution in NestJS runtime
- RUN (local): File system operations

Commands: restore_memories, store_memory
Features: Configurable paths, automatic fallback, detailed logging

**COMPLETED**: CDP Memory Persistence Workflow (2026-03-05)
- Created `cdp_store_memory` - stores memories in NestJS via CDP
- Created `fetch-memories.js` CDP script - reads NestJS runtime state
- Fixed `persist_memories` - merges new memories with existing file (no overwrites)
- Tested: 6 memories + 6 emotions persisted to ai-memories.json
- Architecture: cdp_store_memory → NestJS → fetch-memories.js → persist_memories → ai-memories.json
- Merge logic: Uses Map for deduplication, only adds new memories
