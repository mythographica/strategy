'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstanceInspector = void 0;
// Import Mnemonica - note: this requires mnemonica to be installed
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mnemonica = require('mnemonica');
/**
 * Instance Inspector
 * Provides access to Mnemonica instance data and constructor arguments
 */
class InstanceInspector {
    constructor() {
        // Store for tracking instances (in-memory only)
        this.instanceStore = new Map();
    }
    /**
     * Get properties and constructor arguments for an instance
     */
    async getInstanceData(instanceId) {
        try {
            const instance = this.instanceStore.get(instanceId);
            if (!instance) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                instanceId,
                                error: 'Instance not found',
                                note: 'Instance must be registered first using registerInstance()',
                            }, null, 2),
                        },
                    ],
                };
            }
            // Use mnemonica.getProps() to extract instance data
            const props = mnemonica.getProps(instance);
            const data = {
                id: instanceId,
                type: this.getInstanceType(instance),
                properties: props || {},
                constructorArgs: this.extractConstructorArgs(instance),
                parentInstance: this.getParentInstanceId(instance),
                inheritanceChain: this.buildInstanceChain(instance),
            };
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(data, null, 2),
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
                            error: 'Failed to get instance data',
                            message: error instanceof Error ? error.message : String(error),
                        }, null, 2),
                    },
                ],
            };
        }
    }
    /**
     * Find all instances of a given type
     */
    async findInstances(typeName) {
        try {
            const matchingInstances = [];
            for (const [id, instance] of this.instanceStore.entries()) {
                const instanceType = this.getInstanceType(instance);
                if (instanceType === typeName) {
                    matchingInstances.push(id);
                }
            }
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            typeName,
                            count: matchingInstances.length,
                            instanceIds: matchingInstances,
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
                            error: 'Failed to find instances',
                            message: error instanceof Error ? error.message : String(error),
                        }, null, 2),
                    },
                ],
            };
        }
    }
    /**
     * Register an instance for tracking
     */
    registerInstance(id, instance) {
        this.instanceStore.set(id, instance);
    }
    /**
     * Unregister an instance
     */
    unregisterInstance(id) {
        this.instanceStore.delete(id);
    }
    /**
     * Get the type name of an instance
     */
    getInstanceType(instance) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const constructorName = instance?.constructor?.name;
        return constructorName || 'Unknown';
    }
    /**
     * Extract constructor arguments from instance prototype chain
     */
    extractConstructorArgs(instance) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = instance?.__args__;
        return args || [];
    }
    /**
     * Get parent instance ID if tracked
     */
    getParentInstanceId(instance) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parent = instance?.__parent__;
        if (parent) {
            // Find parent in store
            for (const [id, storedInstance] of this.instanceStore.entries()) {
                if (storedInstance === parent) {
                    return id;
                }
            }
        }
        return undefined;
    }
    /**
     * Build the inheritance chain for an instance
     */
    buildInstanceChain(instance) {
        const chain = [];
        const visited = new Set();
        let current = instance;
        while (current && !visited.has(current)) {
            visited.add(current);
            chain.unshift(this.getInstanceType(current));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            current = current?.__parent__;
        }
        return chain;
    }
}
exports.InstanceInspector = InstanceInspector;
//# sourceMappingURL=instance-inspector.js.map