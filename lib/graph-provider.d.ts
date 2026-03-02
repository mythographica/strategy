/**
 * Graph Provider
 * Extracts and provides access to Mnemonica type hierarchies
 */
export declare class GraphProvider {
    /**
     * Get the complete type graph from Mnemonica runtime
     */
    getTypeGraph(): Promise<{
        content: Array<{
            type: string;
            text: string;
        }>;
    }>;
    /**
     * Get detailed information about a specific type
     */
    getTypeInfo(typeName: string): Promise<{
        content: Array<{
            type: string;
            text: string;
        }>;
    }>;
    /**
     * Get the inheritance chain for a type
     */
    getInheritanceChain(typeName: string): Promise<{
        content: Array<{
            type: string;
            text: string;
        }>;
    }>;
    /**
     * Extract the type graph from Mnemonica types collection
     */
    private extractGraph;
    /**
     * Get parent type name from constructor
     */
    private getParentType;
    /**
     * Get child type names from constructor
     */
    private getChildTypes;
    /**
     * Get property names from type constructor prototype
     */
    private getTypeProperties;
    /**
     * Find a specific type in the collection
     */
    private findType;
    /**
     * Build the inheritance chain for a type
     */
    private buildInheritanceChain;
}
//# sourceMappingURL=graph-provider.d.ts.map