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
exports.CDPConnection = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const CDP = require('chrome-remote-interface');
/**
 * Chrome Debug Protocol Connection
 * Manages connection to Node.js runtime for Mnemonica analysis
 */
class CDPConnection {
    constructor(host = 'localhost', port = 9229) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.client = null;
        this.host = host;
        this.port = port;
    }
    /**
     * Connect to the Node.js debug port
     */
    async connect() {
        try {
            this.client = await CDP({
                host: this.host,
                port: this.port,
            });
            console.error(`Connected to Node.js at ${this.host}:${this.port}`);
        }
        catch (error) {
            throw new Error(`Failed to connect to Node.js debug port: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Disconnect from the runtime
     */
    async disconnect() {
        if (this.client) {
            await this.client.close();
            this.client = null;
            console.error('Disconnected from Node.js');
        }
    }
    /**
     * Evaluate JavaScript in the target runtime
     */
    async evaluate(expression) {
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
            throw new Error(`Runtime error: ${result.exceptionDetails.exception?.description || 'Unknown error'}`);
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return result.result?.value;
    }
    /**
     * Get the Mnemonica defaultTypes from runtime
     */
    async getMnemonicaTypes() {
        // Read the extraction script from file
        const scriptPath = path.join(__dirname, 'extract-types.js');
        const code = fs.readFileSync(scriptPath, 'utf-8');
        return await this.evaluate(code);
    }
    /**
     * Check if connected
     */
    isConnected() {
        return this.client !== null;
    }
}
exports.CDPConnection = CDPConnection;
//# sourceMappingURL=cdp-connection.js.map