import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

/**
 * Simple SSE transport for Hono
 * Bridges MCP Server with Hono's SSE streaming
 */
export class HonoSseTransport implements Transport {
    private _onclose?: () => void;
    public onmessage?: (message: JSONRPCMessage) => void;
    private sendCallback: (message: JSONRPCMessage) => Promise<void>;

    constructor(sendCallback: (message: JSONRPCMessage) => Promise<void>) {
        this.sendCallback = sendCallback;
    }

    async start(): Promise<void> {
        // SSE stream is already active when this transport is created
    }

    async send(message: JSONRPCMessage): Promise<void> {
        await this.sendCallback(message);
    }

    async close(): Promise<void> {
        this._onclose?.();
    }

    // Called by index.ts when receiving messages from client
    handleMessage(message: JSONRPCMessage): void {
        this.onmessage?.(message);
    }

    set onclose(handler: () => void) {
        this._onclose = handler;
    }
}
