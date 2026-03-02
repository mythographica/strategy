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
export declare class TacticaComparison {
    /**
     * Load Tactica-generated types from .tactica/types.ts
     */
    loadTacticaTypes(projectPath: string): Record<string, TypeInfo>;
    /**
     * Parse Tactica types.ts content
     */
    private parseTacticaContent;
    /**
     * Compare runtime types with Tactica types
     */
    compare(runtimeTypes: Record<string, unknown>, tacticaTypes: Record<string, TypeInfo>): ComparisonResult;
    /**
     * Generate a report from comparison results
     */
    generateReport(result: ComparisonResult): string;
}
export {};
//# sourceMappingURL=tactica-comparison.d.ts.map