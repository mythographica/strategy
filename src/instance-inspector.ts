'use strict';

// Import Mnemonica - note: this requires mnemonica to be installed
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mnemonica = require('mnemonica');

interface InstanceData {
	id: string;
	type: string;
	properties: Record<string, unknown>;
	constructorArgs: unknown[];
	parentInstance?: string;
	inheritanceChain: string[];
}

/**
 * Instance Inspector
 * Provides access to Mnemonica instance data and constructor arguments
 */
export class InstanceInspector {
	// Store for tracking instances (in-memory only)
	private instanceStore: Map<string, unknown> = new Map();

	/**
	 * Get properties and constructor arguments for an instance
	 */
	async getInstanceData (
		instanceId: string
	): Promise<{ content: Array<{ type: string; text: string }> }> {
		try {
			const instance = this.instanceStore.get(instanceId);

			if (!instance) {
				return {
					content: [
						{
							type: 'text',
							text: JSON.stringify(
								{
									instanceId,
									error: 'Instance not found',
									note: 'Instance must be registered first using registerInstance()',
								},
								null,
								2
							),
						},
					],
				};
			}

			// Use mnemonica.getProps() to extract instance data
			const props = mnemonica.getProps(instance);

			const data: InstanceData = {
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
		} catch (error) {
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								error: 'Failed to get instance data',
								message: error instanceof Error ? error.message : String(error),
							},
							null,
							2
						),
					},
				],
			};
		}
	}

	/**
	 * Find all instances of a given type
	 */
	async findInstances (
		typeName: string
	): Promise<{ content: Array<{ type: string; text: string }> }> {
		try {
			const matchingInstances: string[] = [];

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
						text: JSON.stringify(
							{
								typeName,
								count: matchingInstances.length,
								instanceIds: matchingInstances,
							},
							null,
							2
						),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: 'text',
						text: JSON.stringify(
							{
								error: 'Failed to find instances',
								message: error instanceof Error ? error.message : String(error),
							},
							null,
							2
						),
					},
				],
			};
		}
	}

	/**
	 * Register an instance for tracking
	 */
	registerInstance (id: string, instance: unknown): void {
		this.instanceStore.set(id, instance);
	}

	/**
	 * Unregister an instance
	 */
	unregisterInstance (id: string): void {
		this.instanceStore.delete(id);
	}

	/**
	 * Get the type name of an instance
	 */
	private getInstanceType (instance: unknown): string {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const constructorName = (instance as any)?.constructor?.name;
		return constructorName || 'Unknown';
	}

	/**
	 * Extract constructor arguments from instance prototype chain
	 */
	private extractConstructorArgs (instance: unknown): unknown[] {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const args = (instance as any)?.__args__;
		return args || [];
	}

	/**
	 * Get parent instance ID if tracked
	 */
	private getParentInstanceId (instance: unknown): string | undefined {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const parent = (instance as any)?.__parent__;
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
	private buildInstanceChain (instance: unknown): string[] {
		const chain: string[] = [];
		const visited = new Set<unknown>();

		let current: unknown = instance;
		while (current && !visited.has(current)) {
			visited.add(current);
			chain.unshift(this.getInstanceType(current));

			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			current = (current as any)?.__parent__;
		}

		return chain;
	}
}
