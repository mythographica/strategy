'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphProvider = void 0;
// Import Mnemonica - note: this requires mnemonica to be installed
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mnemonica = require('mnemonica');
/**
 * Graph Provider
 * Extracts and provides access to Mnemonica type hierarchies
 */
class GraphProvider {
    /**
     * Get the complete type graph from Mnemonica runtime
     */
    async getTypeGraph() {
        try {
            const types = mnemonica.defaultTypes;
            const graph = this.extractGraph(types);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(graph, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            error: 'Failed to extract type graph',
                            message: error instanceof Error ? error.message : String(error),
                        }, null, 2),
                    },
                ],
            };
        }
    }
    /**
     * Get detailed information about a specific type
     */
    async getTypeInfo(typeName) {
        try {
            const types = mnemonica.defaultTypes;
            const typeInfo = this.findType(types, typeName);
            if (!typeInfo) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                typeName,
                                error: 'Type not found',
                            }, null, 2),
                        },
                    ],
                };
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(typeInfo, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            error: 'Failed to get type info',
                            message: error instanceof Error ? error.message : String(error),
                        }, null, 2),
                    },
                ],
            };
        }
    }
    /**
     * Get the inheritance chain for a type
     */
    async getInheritanceChain(typeName) {
        try {
            const types = mnemonica.defaultTypes;
            const chain = this.buildInheritanceChain(types, typeName);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            typeName,
                            chain,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            error: 'Failed to get inheritance chain',
                            message: error instanceof Error ? error.message : String(error),
                        }, null, 2),
                    },
                ],
            };
        }
    }
    /**
     * Extract the type graph from Mnemonica types collection
     */
    extractGraph(types) {
        const nodes = [];
        // Traverse the types collection
        // This is a simplified implementation - actual Mnemonica structure may vary
        if (typeof types === 'object' && types !== null) {
            const typesObj = types;
            // Get all type names from the collection
            const typeNames = Object.keys(typesObj).filter((key) => typeof typesObj[key] === 'function');
            for (const name of typeNames) {
                const typeConstructor = typesObj[name];
                // Extract parent info if available
                const parent = this.getParentType(typeConstructor);
                // Extract subtypes (children)
                const children = this.getChildTypes(typeConstructor);
                // Extract properties (from prototype)
                const properties = this.getTypeProperties(typeConstructor);
                nodes.push({
                    name,
                    parent,
                    children,
                    properties,
                });
            }
        }
        return nodes;
    }
    /**
     * Get parent type name from constructor
     */
    getParentType(typeConstructor) {
        // Mnemonica stores parent info on the constructor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parent = typeConstructor.parent;
        if (parent && typeof parent === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return parent.name || undefined;
        }
        return undefined;
    }
    /**
     * Get child type names from constructor
     */
    getChildTypes(typeConstructor) {
        const children = [];
        // Mnemonica stores subtypes on the constructor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subtypes = typeConstructor.subtypes;
        if (subtypes && typeof subtypes === 'object') {
            children.push(...Object.keys(subtypes));
        }
        return children;
    }
    /**
     * Get property names from type constructor prototype
     */
    getTypeProperties(typeConstructor) {
        const properties = [];
        if (typeConstructor.prototype && typeof typeConstructor.prototype === 'object') {
            const proto = typeConstructor.prototype;
            properties.push(...Object.keys(proto));
        }
        return properties;
    }
    /**
     * Find a specific type in the collection
     */
    findType(types, typeName) {
        const graph = this.extractGraph(types);
        return graph.find((node) => node.name === typeName) || null;
    }
    /**
     * Build the inheritance chain for a type
     */
    buildInheritanceChain(types, typeName) {
        const chain = [];
        const visited = new Set();
        let current = typeName;
        while (current && !visited.has(current)) {
            visited.add(current);
            chain.unshift(current);
            const typeInfo = this.findType(types, current);
            if (typeInfo?.parent) {
                current = typeInfo.parent;
            }
            else {
                break;
            }
        }
        return chain;
    }
}
exports.GraphProvider = GraphProvider;
//# sourceMappingURL=graph-provider.js.map