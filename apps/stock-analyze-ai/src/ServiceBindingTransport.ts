import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export class ServiceBindingTransport implements Transport {
    private _service: Fetcher;
    private _sseUrl: string;
    private _postUrl: string;
    private _abortController: AbortController | null = null;
    private _readyResolver: (() => void) | null = null;
    private _localPort?: string;

    onmessage?: (message: JSONRPCMessage) => void;
    onclose?: () => void;
    onerror?: (error: Error) => void;

    constructor(service: Fetcher, sseUrl: string = "/sse", postUrl: string = "", localPort?: string) {
        this._service = service;
        this._sseUrl = sseUrl;
        this._postUrl = postUrl;
        this._localPort = localPort;
    }

    async start(): Promise<void> {
        this._abortController = new AbortController();

        let response: Response;
        if (this._localPort) {
            const url = `http://127.0.0.1:${this._localPort}${this._sseUrl}`;
            console.log(`[ServiceBindingTransport] Connecting to local MCP server at ${url}`);
            response = await fetch(url, {
                method: "GET",
                headers: {
                    "Accept": "text/event-stream",
                },
                signal: this._abortController.signal,
            });
        } else {
            response = await this._service.fetch(new Request("http://internal" + this._sseUrl, {
                method: "GET",
                headers: {
                    "Accept": "text/event-stream",
                },
                signal: this._abortController.signal,
            }));
        }

        if (!response.ok) {
            throw new Error(`Failed to connect to MCP server: ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
            throw new Error("No response body");
        }

        // Create a promise that resolves when the endpoint event is received
        const readyPromise = new Promise<void>((resolve) => {
            this._readyResolver = resolve;
        });

        // Start reading the stream
        this._readStream(response.body);

        // Wait for the endpoint event
        await readyPromise;
    }

    private async _readStream(body: ReadableStream<Uint8Array>) {
        const reader = body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        let currentEvent: string | null = null;
        let currentData: string | null = null;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                // Keep the last partial line in buffer
                // If the last character was a newline, the last element is empty string, which is fine
                // But we should check if buffer ended with newline or not

                // Better approach:
                // Only process complete lines. If the last line is not empty, it might be incomplete.
                // However, split("\n") puts the remainder in the last element.
                // We should process all elements except the last one, and set buffer to the last one.
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("event: ")) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith("data: ")) {
                        currentData = line.slice(6);
                    } else if (line.trim() === "") {
                        // End of event (empty line)
                        // Trigger event processing
                        if (currentEvent === "endpoint" && currentData) {
                            const url = currentData.trim();
                            // Handle relative URLs by prepending internal origin or localhost
                            this._postUrl = url.startsWith("/") ? url : "/" + url;
                            console.log(`[ServiceBindingTransport] Endpoint updated to: ${this._postUrl}`);
                            if (this._readyResolver) {
                                this._readyResolver();
                                this._readyResolver = null;
                            }
                        } else if (currentEvent === "message" && currentData) {
                            try {
                                const message = JSON.parse(currentData);
                                this.onmessage?.(message);
                            } catch (e) {
                                console.error("[ServiceBindingTransport] Failed to parse SSE message JSON", e);
                            }
                        }

                        // Reset for next event
                        currentEvent = null;
                        currentData = null;
                    }
                }
            }
        } catch (error) {
            if (this._abortController?.signal.aborted) {
                // Expected close
                return;
            }
            console.error("[ServiceBindingTransport] Stream error:", error);
            this.onerror?.(error as Error);
        } finally {
            this.onclose?.();
        }
    }

    async send(message: JSONRPCMessage): Promise<void> {
        if (!this._postUrl) {
            throw new Error("No POST URL available. Waiting for 'endpoint' event from server.");
        }

        let response: Response;
        if (this._localPort) {
            const url = `http://127.0.0.1:${this._localPort}${this._postUrl}`;
            console.log(`[ServiceBindingTransport] Sending message to ${url}`);
            response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(message),
            });
        } else {
            console.log(`[ServiceBindingTransport] Sending message to ${this._postUrl}`);
            response = await this._service.fetch(new Request("http://internal" + this._postUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(message),
            }));
        }

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Failed to send message: ${response.status} ${response.statusText} - ${text}`);
        }
    }

    async close(): Promise<void> {
        this._abortController?.abort();
        this._abortController = null;
    }
}
