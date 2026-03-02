'use strict';

import * as fs from 'fs';
import * as path from 'path';

/**
 * Tool definition from MCP metadata
 */
interface ToolDefinition {
	name: string;
	description: string;
	inputSchema: {
		type: string;
		properties?: Record<string, unknown>;
		required?: string[];
	};
}

/**
 * Command file with metadata and code
 */
interface CommandFile {
	name: string;
	filePath: string;
	metadata: ToolDefinition;
	code: string;
}

/**
 * Parse MCP tool metadata from JavaScript file comments
 * Looks for:
 * /**
 *  * MCP Tool Metadata:
 *  * { ...json... }
 *  *
 /
 */
function parseMetadata(content: string): ToolDefinition | null {
	const metadataMatch = content.match(/\/\*\*\s*\n\s*\*\s*MCP Tool Metadata:\s*\n\s*\*\s*({[\s\S]*?})\s*\n\s*\*\//);
	if (!metadataMatch) {
		return null;
	}

	try {
		// Parse the JSON from the comment
		const jsonStr = metadataMatch[1].replace(/\n\s*\*\s*/g, ' ');
		return JSON.parse(jsonStr) as ToolDefinition;
	} catch {
		return null;
	}
}

/**
 * Load all commands from the commands directory
 */
export function loadCommands(): CommandFile[] {
	const commandsDir = path.join(__dirname, '..', 'commands');
	const commands: CommandFile[] = [];

	if (!fs.existsSync(commandsDir)) {
		console.error(`Commands directory not found: ${commandsDir}`);
		return commands;
	}

	const files = fs.readdirSync(commandsDir);

	for (const file of files) {
		if (!file.endsWith('.js')) {
			continue;
		}

		const filePath = path.join(commandsDir, file);
		const content = fs.readFileSync(filePath, 'utf-8');
		const metadata = parseMetadata(content);

		if (metadata) {
			commands.push({
				name: metadata.name,
				filePath,
				metadata,
				code: content,
			});
		}
	}

	return commands;
}

/**
 * Get tool definitions for ListToolsRequest
 */
export function getToolDefinitions(): ToolDefinition[] {
	const commands = loadCommands();
	return commands.map(cmd => ({
		name: cmd.metadata.name,
		description: cmd.metadata.description,
		inputSchema: cmd.metadata.inputSchema,
	}));
}

/**
 * Get command code for a specific tool name
 */
export function getCommandCode(name: string): string | null {
	const commands = loadCommands();
	const command = commands.find(cmd => cmd.metadata.name === name);
	return command ? command.code : null;
}
