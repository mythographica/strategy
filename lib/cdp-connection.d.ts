/**
 * Chrome Debug Protocol Connection
 * Manages connection to Node.js runtime for Mnemonica analysis
 */
export declare class CDPConnection {
    private client;
    private host;
    private port;
    constructor(host?: string, port?: number);
    /**
     * Connect to the Node.js debug port
     */
    connect(): Promise<void>;
    /**
     * Disconnect from the runtime
     */
    disconnect(): Promise<void>;
    /**
     * Evaluate JavaScript in the target runtime
     */
    evaluate(expression: string): Promise<unknown>;
    /**
     * Get the Mnemonica defaultTypes from runtime
     */
    getMnemonicaTypes(): Promise<unknown>;
    /**
     * Check if connected
     */
    isConnected(): boolean;
}
//# sourceMappingURL=cdp-connection.d.ts.map