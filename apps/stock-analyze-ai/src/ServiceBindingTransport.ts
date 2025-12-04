import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export class ServiceBindingTransport implements Transport {
    private _service: Fetcher;
    private _sseUrl: string;
    private _postUrl: string;
    private _abortController: AbortController | null = null;

    onmessage?: (message: JSONRPCMessage) => void;
    onclose?: () => void;
    onerror?: (error: Error) => void;

    constructor(service: Fetcher, sseUrl: string = "/sse", postUrl: string = "/message") {
        this._service = service;
        this._sseUrl = sseUrl;
        this._postUrl = postUrl;
    }

    async start(): Promise<void> {
        this._abortController = new AbortController();
        const response = await this._service.fetch(new Request("http://internal" + this._sseUrl, {
            method: "GET",
            headers: {
                "Accept": "text/event-stream",
            },
            signal: this._abortController.signal,
        }));

        if (!response.ok) {
            throw new Error(`Failed to connect to MCP server: ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
            throw new Error("No response body");
        }

        // Start reading the stream
        this._readStream(response.body);
    }

    private async _readStream(body: ReadableStream<Uint8Array>) {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // Keep the last partial line

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        try {
                            const message = JSON.parse(data);
                            this.onmessage?.(message);
                        } catch (e) {
                            console.error("Failed to parse SSE message", e);
                        }
                    }
                }
            }
        } catch (error) {
            if (this._abortController?.signal.aborted) {
                // Expected close
                return;
            }
            this.onerror?.(error as Error);
        } finally {
            this.onclose?.();
        }
    }

    async send(message: JSONRPCMessage): Promise<void> {
        const response = await this._service.fetch(new Request("http://internal" + this._postUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
        }));

        if (!response.ok) {
            throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
        }
    }

    async close(): Promise<void> {
        this._abortController?.abort();
        this._abortController = null;
    }
}
