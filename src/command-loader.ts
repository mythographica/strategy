'use strict';

import * as fs from 'fs';
import * as path from 'path';

/**
 * Command context types
 */
export type CommandContext = 'MCP' | 'RPC' | 'RUN';

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
	examples?: Array<{
		description: string;
		args: Record<string, unknown>;
	}>;
}

/**
 * Command file with metadata and code
 */
interface CommandFile {
	name: string;
	filePath: string;
	context: CommandContext;
	folder: string;
	metadata: ToolDefinition;
	code: string;
}

/**
 * Folder configuration for each context
 */
const CONTEXT_FOLDERS: Record<CommandContext, string> = {
	MCP: 'commands-mcp',
	RPC: 'commands-rpc',
	RUN: 'commands-run',
};

/**
 * Parse MCP tool metadata from JavaScript file comments
 * Looks for:
 * /**
 *  * MCP Tool Metadata:
 *  * { ...json... }
 *  *
 */
function parseMetadata (content: string): ToolDefinition | null {
	const metadataMatch = content.match(/\/\*\*\s*\n\s*\*\s*MCP Tool Metadata:\s*\n\s*\*\s*({[\s\S]*?})\s*\n\s*\*\//);
	if (!metadataMatch) {
		return null;
	}

	try {
		// Parse the JSON from the comment
		const jsonStr = metadataMatch[1].replace(/\n\s*\*\s*/g, ' ');
		const metadata = JSON.parse(jsonStr) as ToolDefinition;

		// Note: excludeFromMCP is no longer relevant in v5 architecture
		// All commands are executed through the 3 bundled tools
		return metadata;
	} catch {
		return null;
	}
}

/**
 * Recursively load commands from a directory
 */
function loadCommandsFromDir (dirPath: string, context: CommandContext, folder: string): CommandFile[] {
	const commands: CommandFile[] = [];

	if (!fs.existsSync(dirPath)) {
		return commands;
	}

	const entries = fs.readdirSync(dirPath, { withFileTypes: true });

	for (const entry of entries) {
		const entryPath = path.join(dirPath, entry.name);

		if (entry.isDirectory()) {
			// Recursively load from subdirectories
			const subCommands = loadCommandsFromDir(entryPath, context, entry.name);
			commands.push(...subCommands);
		} else if (entry.isFile() && entry.name.endsWith('.js')) {
			const content = fs.readFileSync(entryPath, 'utf-8');
			const metadata = parseMetadata(content);

			if (metadata) {
				commands.push({
					name: metadata.name,
					filePath: entryPath,
					context,
					folder,
					metadata,
					code: content,
				});
			}
		}
	}

	return commands;
}

/**
 * Load all commands from all context folders
 */
export function loadCommands (context?: CommandContext): CommandFile[] {
	const baseDir = path.join(__dirname, '..');
	const commands: CommandFile[] = [];

	if (context) {
		// Load only specified context
		const folder = CONTEXT_FOLDERS[context];
		const dirPath = path.join(baseDir, folder);
		commands.push(...loadCommandsFromDir(dirPath, context, ''));
	} else {
		// Load all contexts
		for (const [ctx, folder] of Object.entries(CONTEXT_FOLDERS)) {
			const dirPath = path.join(baseDir, folder);
			commands.push(...loadCommandsFromDir(dirPath, ctx as CommandContext, ''));
		}
	}

	return commands;
}

/**
 * Get list of commands for a specific context
 * Returns simplified info for list command
 */
export function listCommands (context?: CommandContext): Array<{
	name: string;
	context: CommandContext;
	folder: string;
	description: string;
}> {
	const commands = loadCommands(context);
	return commands.map(cmd => ({
		name: cmd.metadata.name,
		context: cmd.context,
		folder: cmd.folder,
		description: cmd.metadata.description,
	}));
}

/**
 * Get detailed help for a specific command
 */
export function getCommandHelp (
	context: CommandContext,
	commandName: string
): {
	name: string;
	description: string;
	context: CommandContext;
	folder: string;
	inputSchema: Record<string, unknown>;
	examples: Array<{
		description: string;
		execute: {
			context: CommandContext;
			command: string;
			args: Record<string, unknown>;
		};
	}>;
	related: string[];
} | null {
	const commands = loadCommands(context);
	const command = commands.find(cmd => cmd.metadata.name === commandName);

	if (!command) {
		return null;
	}

	// Build examples from metadata or generate defaults
	const examples = command.metadata.examples || [];
	const formattedExamples = examples.map(ex => ({
		description: ex.description,
		execute: {
			context: command.context,
			command: command.metadata.name,
			args: ex.args,
		},
	}));

	// Find related commands in same folder
	const related = commands
		.filter(cmd => cmd.folder === command.folder && cmd.metadata.name !== commandName)
		.map(cmd => cmd.metadata.name);

	return {
		name: command.metadata.name,
		description: command.metadata.description,
		context: command.context,
		folder: command.folder,
		inputSchema: command.metadata.inputSchema,
		examples: formattedExamples,
		related: related.slice(0, 5), // Limit to 5 related
	};
}

/**
 * Get command file path by name and context
 */
export function getCommandPath (context: CommandContext, commandName: string): string | null {
	const commands = loadCommands(context);
	const command = commands.find(cmd => cmd.metadata.name === commandName);
	return command ? command.filePath : null;
}

/**
 * Get command code for a specific tool name and context
 */
export function getCommandCode (context: CommandContext, name: string): string | null {
	const commands = loadCommands(context);
	const command = commands.find(cmd => cmd.metadata.name === name);
	return command ? command.code : null;
}

/**
 * Check if command should run locally (has module.exports.run)
 */
export function isLocalCommand (code: string): boolean {
	return code.includes('module.exports') && code.includes('run');
}
