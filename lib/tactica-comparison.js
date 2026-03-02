'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TacticaComparison = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Tactica Comparison
 * Compares runtime Mnemonica types with Tactica-generated types
 */
class TacticaComparison {
    /**
     * Load Tactica-generated types from .tactica/types.ts
     */
    loadTacticaTypes(projectPath) {
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
    parseTacticaContent(content) {
        const types = {};
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
            const subtypes = [];
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
    compare(runtimeTypes, tacticaTypes) {
        // Cast runtime types to expected format
        const typedRuntimeTypes = runtimeTypes;
        const runtimeKeys = Object.keys(typedRuntimeTypes);
        const tacticaKeys = Object.keys(tacticaTypes);
        // Find missing types
        const missingFromTactica = runtimeKeys.filter((key) => !tacticaKeys.includes(key + 'Instance'));
        // Find extra types in Tactica
        const extraInTactica = tacticaKeys.filter((key) => !runtimeKeys.includes(key.replace('Instance', '')));
        // Find mismatches
        const mismatches = [];
        for (const runtimeKey of runtimeKeys) {
            const tacticaKey = runtimeKey + 'Instance';
            const runtimeType = typedRuntimeTypes[runtimeKey];
            const tacticaType = tacticaTypes[tacticaKey];
            if (!tacticaType)
                continue;
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
            const runtimeSubtypes = runtimeType.subtypes.map((s) => s + 'Instance');
            const missingSubtypes = runtimeSubtypes.filter((s) => !tacticaType.subtypes.includes(s));
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
    generateReport(result) {
        const lines = [];
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
exports.TacticaComparison = TacticaComparison;
//# sourceMappingURL=tactica-comparison.js.map