# @mnemonica/strategy

MCP (Model Context Protocol) server for Mnemonica runtime analysis via Chrome Debug Protocol.

> **Status: pre-release.** This package is **not published on npm** yet.
> `npm install @mnemonica/strategy` and `npx @mnemonica/strategy` will NOT
> work. Build from source as shown below.

## Overview

Strategy connects to running Node.js applications via Chrome Debug Protocol to extract and analyze Mnemonica type hierarchies. It compares runtime types with Tactica-generated types to validate and improve static analysis.

## Installation (from source)

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
node /path/to/strategy/lib/cli.js
```

### MCP Configuration

Add to your agent framework's MCP config:

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

## Command Contexts

| Context | Folder | Execution Environment |
|---------|--------|----------------------|
| MCP | `commands-mcp/` | Local MCP server process |
| RPC | `commands-rpc/` | Local orchestration; effects in the target via CDP |
| RUN | `commands-run/` | Local side effects (files, utilities) |

Command names carry their context as a prefix (`mcp_`, `rpc_`, `run_`), so
the site of execution is visible in the name itself.

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
├── create-type.js          # Creates mnemonica types in NestJS
└── analyze-hierarchy.js    # Retrieves complete type hierarchy
```

**How it works:**
1. MCP command reads the script file
2. Injects `var args = {...}` at the top with command arguments
3. Sends to NestJS via `client.Runtime.evaluate({ expression: script })`
4. Script executes in isolated VM context inside NestJS
5. Console.log output appears in NestJS terminal (not MCP output)
6. Return value is sent back to MCP

**Key patterns for CDP scripts:**
```javascript
// Use process.mainModule.require (not require) because CDP runs in isolated VM
var mnemonica = process.mainModule.require('mnemonica');

// Access types via subtypes Map (avoids proxy enumeration issues)
defaultCollection.subtypes.forEach(function (Type, name) {
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

Commands are JavaScript files in the `commands-*/` folders with MCP Tool Metadata:

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

var { require, args, store } = ctx;

// Parse message if present
var commandArgs = args;
if (args.message && typeof args.message === 'string') {
  try {
    commandArgs = JSON.parse(args.message);
  } catch (e) {
    return { success: false, error: 'Invalid JSON: ' + e.message };
  }
}

// Access parsed arguments
var myArg = commandArgs.argName;

// Return result
return { success: true, data: { ... } };
```

## License

MIT
