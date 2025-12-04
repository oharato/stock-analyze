import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export class HonoSseTransport implements Transport {
    private _onclose?: () => void;
    private _onerror?: (error: Error) => void;
    public onmessage?: (message: JSONRPCMessage) => void;
    private sendCallback?: (message: JSONRPCMessage) => Promise<void>;
    public sessionId: string;

    constructor(sessionId: string, sendCallback: (message: JSONRPCMessage) => Promise<void>) {
        this.sessionId = sessionId;
        this.sendCallback = sendCallback;
    }

    async start(): Promise<void> {
        // Nothing to do here for SSE as the stream is already handled by Hono
    }

    async send(message: JSONRPCMessage): Promise<void> {
        if (this.sendCallback) {
            await this.sendCallback(message);
        }
    }

    async close(): Promise<void> {
        this.sendCallback = undefined;
        if (this._onclose) {
            this._onclose();
        }
    }

    handleMessage(message: JSONRPCMessage): void {
        if (this.onmessage) {
            this.onmessage(message);
        }
    }

    set onclose(handler: () => void) { this._onclose = handler; }
    set onerror(handler: (error: Error) => void) { this._onerror = handler; }
}
