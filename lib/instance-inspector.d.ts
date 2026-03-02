/**
 * Instance Inspector
 * Provides access to Mnemonica instance data and constructor arguments
 */
export declare class InstanceInspector {
    private instanceStore;
    /**
     * Get properties and constructor arguments for an instance
     */
    getInstanceData(instanceId: string): Promise<{
        content: Array<{
            type: string;
            text: string;
        }>;
    }>;
    /**
     * Find all instances of a given type
     */
    findInstances(typeName: string): Promise<{
        content: Array<{
            type: string;
            text: string;
        }>;
    }>;
    /**
     * Register an instance for tracking
     */
    registerInstance(id: string, instance: unknown): void;
    /**
     * Unregister an instance
     */
    unregisterInstance(id: string): void;
    /**
     * Get the type name of an instance
     */
    private getInstanceType;
    /**
     * Extract constructor arguments from instance prototype chain
     */
    private extractConstructorArgs;
    /**
     * Get parent instance ID if tracked
     */
    private getParentInstanceId;
    /**
     * Build the inheritance chain for an instance
     */
    private buildInstanceChain;
}
//# sourceMappingURL=instance-inspector.d.ts.map