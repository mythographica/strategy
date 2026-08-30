'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSSession = void 0;
const ws_1 = __importDefault(require("ws"));
const DEFAULT_TIMEOUT_MS = 30000;
class WSSession {
    constructor(socket) {
        this.nextId = 1;
        this.pending = new Map();
        this.notifications = new Map();
        this.closed = false;
        /**
         * The server's welcome frame, if it arrived. Carries the target's
         * protocol version, pid, mnemonica version and root type names.
         */
        this.welcome = null;
        this.socket = socket;
        socket.on('message', (data) => {
            this.onMessage(data);
        });
        socket.on('close', () => {
            this.onClose();
        });
        // 'error' is always followed by 'close' in ws — cleanup lives there
        socket.on('error', () => { });
    }
    static async connect(host, port, token) {
        const url = `ws://${host}:${port}/?token=${token}`;
        const socket = new ws_1.default(url, {
            // the in-target server caps messages at 16 MiB; match it here
            maxPayload: 16 * 1024 * 1024,
        });
        await new Promise((resolve, reject) => {
            socket.once('open', () => resolve());
            socket.once('error', (err) => reject(err));
        });
        const session = new WSSession(socket);
        return session;
    }
    get isOpen() {
        const open = !this.closed && this.socket.readyState === ws_1.default.OPEN;
        return open;
    }
    /**
     * Subscribe to an unsolicited server frame by its `op` (e.g. 'trace').
     * Pass null to detach. Notifications carry no `id` — they never
     * interfere with the request/response correlation.
     */
    setNotificationHandler(op, handler) {
        if (handler) {
            this.notifications.set(op, handler);
        }
        else {
            this.notifications.delete(op);
        }
    }
    async request(op, params = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
        if (this.closed) {
            throw new Error('WS session is closed — re-run ws_bootstrap');
        }
        const id = this.nextId++;
        const response = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`ws request "${op}" timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timer });
        });
        this.socket.send(JSON.stringify({ id, op, params }));
        const result = await response;
        return result;
    }
    close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        try {
            this.socket.close();
        }
        catch {
            // already gone
        }
        this.onClose();
    }
    onMessage(data) {
        let msg;
        try {
            msg = JSON.parse(String(data));
        }
        catch {
            return;
        }
        if (msg.op === 'welcome') {
            this.welcome = msg;
            return;
        }
        if (typeof msg.id !== 'number') {
            // Unsolicited server frame (notification) — e.g. the trace push
            // channel's { op: 'trace', params: { edges } }.
            if (msg.op) {
                const handler = this.notifications.get(msg.op);
                if (handler) {
                    handler(msg.params);
                }
            }
            return;
        }
        const entry = this.pending.get(msg.id);
        if (!entry) {
            return;
        }
        this.pending.delete(msg.id);
        clearTimeout(entry.timer);
        if (msg.ok) {
            entry.resolve(msg.result);
        }
        else {
            const message = msg.error?.message || 'unknown in-target error';
            const err = new Error(message);
            if (msg.error?.stack) {
                err.stack = msg.error.stack;
            }
            entry.reject(err);
        }
    }
    onClose() {
        this.closed = true;
        for (const entry of this.pending.values()) {
            clearTimeout(entry.timer);
            entry.reject(new Error('WS connection to target closed'));
        }
        this.pending.clear();
    }
}
exports.WSSession = WSSession;
//# sourceMappingURL=ws-session.js.map