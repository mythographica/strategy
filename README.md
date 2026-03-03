# @mnemonica/strategy

MCP (Model Context Protocol) server for Mnemonica runtime analysis via Chrome Debug Protocol.

## Overview

Strategy connects to running Node.js applications via Chrome Debug Protocol to extract and analyze Mnemonica type hierarchies. It compares runtime types with Tactica-generated types to validate and improve static analysis.

## Installation

```bash
npm install @mnemonica/strategy
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

### As MCP Server

```bash
npx @mnemonica/strategy
```

### Configure with Roo Code

Add to `.roo/mcp.json`:

```json
{
	"mcpServers": {
		"mnemonica-strategy": {
			"command": "node",
			"args": ["/code/mnemonica/strategy/lib/cli.js"]
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
// Connect to NestJS debugger
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

// Get runtime types
execute {
  context: "RPC",
  command: "get_runtime_types",
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
help { context: "RPC", command: "connection" }
```

## Args Passing Mechanism (IMPORTANT)

Due to MCP protocol limitations, command arguments must be passed as a **JSON string** in the `message` field, not as direct object properties.

**Correct format:**
```javascript
execute {
  context: "RPC",
  command: "connection",
  message: "{ \"action\": \"connect\", \"host\": \"localhost\", \"port\": 9229 }"
}
```

**Incorrect format (will not work):**
```javascript
// DON'T DO THIS
execute {
  context: "RPC",
  command: "connection",
  args: { action: "connect" }  // This won't work!
}
```

## Common Commands

### Connection Management

```javascript
// Connect to Node.js debugger
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
```

### Type Analysis

```javascript
// Get runtime types from connected application
execute {
  context: "RPC",
  command: "get_runtime_types",
  message: "{}"
}

// Analyze type hierarchy
execute {
  context: "RPC",
  command: "analyze_type_hierarchy",
  message: "{}"
}

// Load Tactica-generated types
execute {
  context: "MCP",
  command: "load_remote_tactica_types",
  message: "{ \"projectPath\": \"/path/to/project\" }"
}

// Compare runtime vs Tactica types
execute {
  context: "MCP",
  command: "compare_with_tactica",
  message: "{ \"projectPath\": \"/path/to/project\" }"
}
```

### Memory Management

```javascript
// Store memory in connected runtime
execute {
  context: "RPC",
  command: "store_memory",
  message: "{ \"key\": \"myKey\", \"data\": { ... } }"
}

// Recall memories
execute {
  context: "RPC",
  command: "recall_memories",
  message: "{ \"key\": \"myKey\" }"
}
```

## Example Workflow

1. Start your application with debug mode:
   ```bash
   cd tactica-examples/nestjs
   npm run start:debug
   ```

2. Connect to the debugger:
   ```javascript
   execute {
     context: "RPC",
     command: "connection",
     message: "{ \"action\": \"connect\" }"
   }
   ```

3. Analyze runtime types:
   ```javascript
   execute {
     context: "RPC",
     command: "get_runtime_types",
     message: "{}"
   }
   ```

4. Compare with Tactica-generated types:
   ```javascript
   execute {
     context: "MCP",
     command: "compare_with_tactica",
     message: "{ \"projectPath\": \"/path/to/project\" }"
   }
   ```

## Command Contexts

| Context | Folder | Execution Environment |
|---------|--------|----------------------|
| MCP | `commands-mcp/` | Local MCP server process |
| RPC | `commands-remote/` | Remote via CDP in target Node.js |
| RUN | `commands-run/` | HTTP endpoint in VS Code |

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
