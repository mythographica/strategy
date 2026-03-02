'use strict';

import * as fs from 'fs';
import * as path from 'path';

interface TypeInfo {
	name: string;
	parent: string | null;
	subtypes: string[];
}

interface ComparisonResult {
	runtimeTypes: Record<string, TypeInfo>;
	tacticaTypes: Record<string, TypeInfo>;
	missingFromTactica: string[];
	extraInTactica: string[];
	mismatches: Array<{
		typeName: string;
		runtime: TypeInfo;
		tactica: TypeInfo;
		issue: string;
	}>;
}

/**
 * Tactica Comparison
 * Compares runtime Mnemonica types with Tactica-generated types
 */
export class TacticaComparison {
	/**
	 * Load Tactica-generated types from .tactica/types.ts
	 */
	loadTacticaTypes (projectPath: string): Record<string, TypeInfo> {
		const tacticaPath = path.join(projectPath, '.tactica', 'types.ts');

		if (!fs.existsSync(tacticaPath)) {
			throw new Error(`Tactica types not found at ${tacticaPath}`);
		}

		const content = fs.readFileSync(tacticaPath, 'utf-8');
		return this.parseTacticaContent(content);
	}

	/**
	 * Parse Tactica types.ts content
	 */
	private parseTacticaContent (content: string): Record<string, TypeInfo> {
		const types: Record<string, TypeInfo> = {};

		// Extract export type declarations
		// Pattern: export type TypeNameInstance = ...
		const typeRegex = /export type (\w+Instance)\s*=/g;
		let match;

		while ((match = typeRegex.exec(content)) !== null) {
			const typeName = match[1];
			const startIdx = match.index;

			// Find the full type definition (up to semicolon or newline)
			const endIdx = content.indexOf(';', startIdx);
			const definition = content.substring(startIdx, endIdx > -1 ? endIdx : startIdx + 200);

			// Parse parent type (intersection pattern: Type & ParentType)
			const parentMatch = definition.match(/&\s*(\w+Instance)/);
			const parent = parentMatch ? parentMatch[1] : null;

			// Look for constructor property (subtypes)
			const subtypes: string[] = [];
			const constructorMatch = definition.match(/(\w+):\s*TypeConstructor</);
			if (constructorMatch) {
				subtypes.push(constructorMatch[1]);
			}

			types[typeName] = {
				name: typeName,
				parent,
				subtypes,
			};
		}

		return types;
	}

	/**
	 * Compare runtime types with Tactica types
	 */
	compare (
		runtimeTypes: Record<string, unknown>,
		tacticaTypes: Record<string, TypeInfo>
	): ComparisonResult {
		// Cast runtime types to expected format
		const typedRuntimeTypes = runtimeTypes as Record<string, TypeInfo>;
		const runtimeKeys = Object.keys(typedRuntimeTypes);
		const tacticaKeys = Object.keys(tacticaTypes);

		// Find missing types
		const missingFromTactica = runtimeKeys.filter((key) => !tacticaKeys.includes(key + 'Instance'));

		// Find extra types in Tactica
		const extraInTactica = tacticaKeys.filter((key) => !runtimeKeys.includes(key.replace('Instance', '')));

		// Find mismatches
		const mismatches: ComparisonResult['mismatches'] = [];

		for (const runtimeKey of runtimeKeys) {
			const tacticaKey = runtimeKey + 'Instance';
			const runtimeType = typedRuntimeTypes[runtimeKey];
			const tacticaType = tacticaTypes[tacticaKey];

			if (!tacticaType) continue;

			// Check parent mismatch
			if (runtimeType.parent) {
				const expectedParent = runtimeType.parent + 'Instance';
				if (tacticaType.parent !== expectedParent) {
					mismatches.push({
						typeName: runtimeKey,
						runtime: runtimeType,
						tactica: tacticaType,
						issue: `Parent mismatch: runtime has ${runtimeType.parent}, tactica has ${tacticaType.parent}`,
					});
				}
			}

			// Check subtypes mismatch
			const runtimeSubtypes = runtimeType.subtypes.map((s: string) => s + 'Instance');
			const missingSubtypes = runtimeSubtypes.filter((s: string) => !tacticaType.subtypes.includes(s));
			if (missingSubtypes.length > 0) {
				mismatches.push({
					typeName: runtimeKey,
					runtime: runtimeType,
					tactica: tacticaType,
					issue: `Missing subtypes in Tactica: ${missingSubtypes.join(', ')}`,
				});
			}
		}

		return {
			runtimeTypes: typedRuntimeTypes,
			tacticaTypes,
			missingFromTactica,
			extraInTactica,
			mismatches,
		};
	}

	/**
	 * Generate a report from comparison results
	 */
	generateReport (result: ComparisonResult): string {
		const lines: string[] = [];

		lines.push('# Mnemonica vs Tactica Comparison Report');
		lines.push('');

		lines.push(`## Summary`);
		lines.push(`- Runtime types: ${Object.keys(result.runtimeTypes).length}`);
		lines.push(`- Tactica types: ${Object.keys(result.tacticaTypes).length}`);
		lines.push(`- Missing from Tactica: ${result.missingFromTactica.length}`);
		lines.push(`- Extra in Tactica: ${result.extraInTactica.length}`);
		lines.push(`- Mismatches: ${result.mismatches.length}`);
		lines.push('');

		if (result.missingFromTactica.length > 0) {
			lines.push('## Missing from Tactica');
			result.missingFromTactica.forEach((type) => lines.push(`- ${type}`));
			lines.push('');
		}

		if (result.mismatches.length > 0) {
			lines.push('## Mismatches');
			result.mismatches.forEach((m) => {
				lines.push(`### ${m.typeName}`);
				lines.push(`- ${m.issue}`);
			});
			lines.push('');
		}

		return lines.join('\n');
	}
}
