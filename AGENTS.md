# AGENTS.md - @mnemonica/strategy

Guidance for AI agents working on the Mnemonica Strategy MCP Server.

## Project Overview

**@mnemonica/strategy** is a Model Context Protocol (MCP) server that provides AI agents with runtime access to Mnemonica type graphs via Chrome Debug Protocol. It compares runtime types with Tactica-generated static analysis to validate and improve type inference.

### Key Innovation: Self-Modifying Commands

The Strategy MCP server supports **dynamic command loading** from the `commands/` directory. As an AI agent, you can:

1. **Create new commands** by writing `.js` files to `strategy/commands/`
2. **Execute immediately** via `dynamic_tool` without MCP restart
3. **Test iteratively** - modify, run, refine without asking for rebuilds

This creates a feedback loop where you can extend your own capabilities dynamically.

## Architecture

### 1. CDPConnection (`src/cdp-connection.ts`)
- Connects to Node.js debug port (default: localhost:9229)
- Uses Chrome Remote Interface to evaluate code in the target runtime
- Extracts Mnemonica types from `defaultCollection` Map

### 2. Command Loader (`src/command-loader.ts`)
- Dynamically loads commands from `commands/` directory
- Parses MCP Tool Metadata from JSDoc comments
- Supports both IIFE (remote) and `run()` export (local) patterns

### 3. StrategyServer (`src/server.ts`)
- MCP server implementing the Model Context Protocol
- Built-in tools + dynamic command loading
- `dynamic_tool` for executing any command by filename

## MCP Tools

### Built-in Tools

| Tool | Purpose |
|------|---------|
| `connect_to_runtime` | Connect to Node.js debug port |
| `disconnect_from_runtime` | Disconnect from runtime |
| `load_tactica_types` | Load Tactica types from `.tactica/types.ts` (local) |
| `compare_with_tactica` | Compare runtime vs Tactica types |

### Dynamic Tool (Meta-Command)

| Tool | Purpose |
|------|---------|
| `dynamic_tool` | Execute any command from `commands/` directory |

**Usage:**
```javascript
dynamic_tool {
  commandName: "analyze-type-hierarchy",
  args: { projectPath: "/path/to/project" },
  remote: true  // true = via CDP, false = local execution
}
```

## Commands Directory

Location: `strategy/commands/`

### Creating New Commands

1. Create a `.js` file in `commands/` directory
2. Add MCP Tool Metadata in JSDoc comment
3. Implement as IIFE for remote execution, or export `run()` for local

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

### Standard Analysis
1. Start target app with debug: `nest start --debug --watch`
2. Connect: `connect_to_runtime`
3. Extract: `get_runtime_types` or `dynamic_tool { commandName: "get-runtime-types", remote: true }`
4. Compare: `compare_with_tactica`

### Dynamic Command Development
1. Create command file in `commands/my-command.js`
2. Test immediately: `dynamic_tool { commandName: "my-command", remote: true }`
3. Iterate - edit file, run again, no restart needed
4. When stable, it's automatically available

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

## AI Agent Capabilities

As an AI agent with the Strategy MCP server, you can:

1. **Inspect Running Apps** - Connect to any Node.js app with `--inspect`
2. **Extract Type Graphs** - Get complete Mnemonica inheritance hierarchies
3. **Validate Tactica** - Compare static analysis with runtime reality
4. **Self-Extend** - Create new commands dynamically without restarts
5. **Iterate Rapidly** - Test command modifications instantly

### Key Insight

The `commands/` directory is your **extensible memory**. You can:
- Write code to add capabilities
- Execute via `dynamic_tool`
- Persist commands for future use
- Never need to ask for rebuilds during development

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

## Remember

- **No rebuild needed** for command development
- **dynamic_tool** is your gateway to all commands
- **remote: true** for CDP, **remote: false** for local
- **commands/** is your toolkit - extend it freely!
