'use strict';

import * as fs from 'fs';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CDP = require('chrome-remote-interface');

/**
 * Chrome Debug Protocol Connection
 * Manages connection to Node.js runtime for Mnemonica analysis
 */
export class CDPConnection {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private client: any | null = null;
	private host: string;
	private port: number;

	constructor (host = 'localhost', port = 9229) {
		this.host = host;
		this.port = port;
	}

	/**
	 * Connect to the Node.js debug port
	 */
	async connect (): Promise<void> {
		try {
			this.client = await CDP({
				host: this.host,
				port: this.port,
			});
			console.error(`Connected to Node.js at ${this.host}:${this.port}`);
		} catch (error) {
			throw new Error(
				`Failed to connect to Node.js debug port: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * Disconnect from the runtime
	 */
	async disconnect (): Promise<void> {
		if (this.client) {
			await this.client.close();
			this.client = null;
			console.error('Disconnected from Node.js');
		}
	}

	/**
	 * Evaluate JavaScript in the target runtime
	 */
	async evaluate (expression: string): Promise<unknown> {
		if (!this.client) {
			throw new Error('Not connected to Node.js runtime');
		}

		const { Runtime } = this.client;
		const result = await Runtime.evaluate({
			expression,
			returnByValue: true,
			awaitPromise: true,
		});

		if (result.exceptionDetails) {
			throw new Error(
				`Runtime error: ${result.exceptionDetails.exception?.description || 'Unknown error'}`
			);
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return result.result?.value;
	}

	/**
	 * Get the Mnemonica defaultTypes from runtime
	 */
	async getMnemonicaTypes (): Promise<unknown> {
		// Read the extraction script from file
		const scriptPath = path.join(__dirname, 'extract-types.js');
		const code = fs.readFileSync(scriptPath, 'utf-8');
		return await this.evaluate(code);
	}

	/**
	 * Check if connected
	 */
	isConnected (): boolean {
		return this.client !== null;
	}
}
