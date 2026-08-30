/**
 * Handler for unsolicited server frames — currently the trace push
 * channel's `{ op: 'trace', params: { edges } }` (traceSubscribe).
 */
type NotificationHandler = (params: unknown) => void;
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
    private notifications;
    private closed;
    /**
     * The server's welcome frame, if it arrived. Carries the target's
     * protocol version, pid, mnemonica version and root type names.
     */
    welcome: WelcomeMessage | null;
    private constructor();
    static connect(host: string, port: number, token: string): Promise<WSSession>;
    get isOpen(): boolean;
    /**
     * Subscribe to an unsolicited server frame by its `op` (e.g. 'trace').
     * Pass null to detach. Notifications carry no `id` — they never
     * interfere with the request/response correlation.
     */
    setNotificationHandler(op: string, handler: NotificationHandler | null): void;
    request(op: string, params?: Record<string, unknown>, timeoutMs?: number): Promise<unknown>;
    close(): void;
    private onMessage;
    private onClose;
}
export {};
//# sourceMappingURL=ws-session.d.ts.map