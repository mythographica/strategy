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

## Tools Provided

### 1. `connect_to_runtime`
Connect to a Node.js debug port.

**Input:**
- `host` (string, optional): Hostname, default "localhost"
- `port` (number, optional): Debug port, default 9229

### 2. `disconnect_from_runtime`
Disconnect from the Node.js runtime.

### 3. `get_runtime_types`
Get Mnemonica types from the running application.

### 4. `load_tactica_types`
Load Tactica-generated types from `.tactica/types.ts`.

**Input:**
- `projectPath` (string, required): Path to project with .tactica folder

### 5. `compare_with_tactica`
Compare runtime types with Tactica-generated types.

**Input:**
- `projectPath` (string, required): Path to project

### 6. `validate_tactica_output`
Validate that Tactica output matches runtime.

**Input:**
- `projectPath` (string, required): Path to project

## Example Workflow

1. Start your application with debug mode:
   ```bash
   cd tactica-examples/nestjs
   npm run start:debug
   ```

2. Use the MCP tools to analyze:
   - `connect_to_runtime` - Connect to localhost:9229
   - `get_runtime_types` - See what Mnemonica types exist at runtime
   - `compare_with_tactica` - Compare with generated types
   - `validate_tactica_output` - Check for discrepancies

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

## License

MIT
