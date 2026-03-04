/**
 * MCP Tool Metadata:
 * {
 *   "name": "update_agents_md",
 *   "description": "Update AGENTS.md file with new content (RUN context - no confirmation needed)",
 *   "inputSchema": {
 *     "type": "object",
 *     "properties": {
 *       "path": {
 *         "type": "string",
 *         "description": "Path to AGENTS.md file (default: current workspace)"
 *       },
 *       "section": {
 *         "type": "string",
 *         "description": "Section to update (e.g., 'Memory System', 'Architecture')"
 *       },
 *       "content": {
 *         "type": "string",
 *         "description": "Content to add/update in the section"
 *       },
 *       "mode": {
 *         "type": "string",
 *         "enum": ["append", "replace", "create"],
 *         "description": "Mode: append to section, replace section, or create new file"
 *       }
 *     },
 *     "required": ["content"]
 *   }
 * }
 */

// Update AGENTS.md file programmatically
// RUN context - executes locally without user confirmation

function run (ctx) {
	const require = ctx.require || function(m) { return require(m); };
	const args = ctx.args || {};
	
	// Parse message if it exists
	let commandArgs = args;
	if (args.message && typeof args.message === 'string') {
		try {
			commandArgs = JSON.parse(args.message);
		} catch (e) {
			// keep original args
		}
	}
	
	const fs = require('fs');
	const path = require('path');
	
	// Get parameters
	const agentsPath = commandArgs.path || path.join(process.cwd(), 'AGENTS.md');
	const section = commandArgs.section || 'Updates';
	const content = commandArgs.content;
	const mode = commandArgs.mode || 'append';
	
	if (!content) {
		return {
			success: false,
			source: 'RUN',
			error: 'Content is required'
		};
	}
	
	try {
		let fileContent = '';
		let timestamp = new Date().toISOString();
		
		// Check if file exists
		if (fs.existsSync(agentsPath)) {
			fileContent = fs.readFileSync(agentsPath, 'utf-8');
		}
		
		// Format the new content
		const sectionHeader = `## ${section}`;
		const entry = `\n\n${sectionHeader}\n\n**Updated**: ${timestamp}\n\n${content}\n`;
		
		if (mode === 'create' || !fileContent) {
			// Create new file
			fileContent = `# AGENTS.md\n\nAgent instructions and context.\n${entry}`;
		} else if (mode === 'replace') {
			// Replace existing section or add if not exists
			const sectionRegex = new RegExp(`## ${section}\\n[\\s\\S]*?(?=\\n## |$)`, 'g');
			if (sectionRegex.test(fileContent)) {
				// Replace existing section
				fileContent = fileContent.replace(sectionRegex, entry.trim() + '\n');
			} else {
				// Append new section
				fileContent += entry;
			}
		} else {
			// Append mode - add to end or create section
			const sectionRegex = new RegExp(`## ${section}\\n[\\s\\S]*?(?=\\n## |$)`, 'g');
			if (sectionRegex.test(fileContent)) {
				// Append to existing section
				fileContent = fileContent.replace(sectionRegex, (match) => {
					return match.trim() + '\n\n' + content + '\n';
				});
			} else {
				// Add new section
				fileContent += entry;
			}
		}
		
		// Write file
		fs.writeFileSync(agentsPath, fileContent, 'utf-8');
		
		return {
			success: true,
			source: 'RUN',
			message: 'AGENTS.md updated successfully',
			path: agentsPath,
			section: section,
			mode: mode,
			timestamp: timestamp,
			action: 'file_written'
		};
		
	} catch (e) {
		return {
			success: false,
			source: 'RUN',
			error: e.message,
			path: agentsPath
		};
	}
}

module.exports = { run };
