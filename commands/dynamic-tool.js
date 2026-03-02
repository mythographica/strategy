/**
 * MCP Tool Metadata:
 * {
 *   "name": "dynamic_tool",
 *   "description": "Execute any command from the commands directory by filename. This allows running dynamically created commands without MCP restart.",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "commandName": {
 *         "type": "string",
 *         "description": "Name of the command file to execute (without .js extension)"
 *       },
 *       "args": {
 *         "type": "object",
 *         "description": "Arguments to pass to the command"
 *       }
 *     },
 *     "required": ["commandName"]
 *   }
 * }
 */

// This is a meta-command - the actual execution happens server-side
// The server reads the command file and executes it

null
