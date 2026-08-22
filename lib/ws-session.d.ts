export interface WelcomeMessage {
    op: 'welcome';
    protocol: number;
    pid: number;
    mnemonica: string | null;
    rootTypes: string[];
}
export declare class WSSession {
    private socket;
    private nextId;
    private pending;
    private closed;
    /**
     * The server's welcome frame, if it arrived. Carries the target's
     * protocol version, pid, mnemonica version and root type names.
     */
    welcome: WelcomeMessage | null;
    private constructor();
    static connect(host: string, port: number, token: string): Promise<WSSession>;
    get isOpen(): boolean;
    request(op: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>;
    close(): void;
    private onMessage;
    private onClose;
}
//# sourceMappingURL=ws-session.d.ts.map