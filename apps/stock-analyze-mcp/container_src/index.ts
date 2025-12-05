import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import { config } from 'dotenv';
import { DuckDBService, Env } from './duckdb.service.js';
import { McpService } from './mcp.service.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { HonoSseTransport } from './hono-transports.js';

config();

const app = new Hono();
const transports = new Map<string, HonoSseTransport>();
let duckDBService: DuckDBService | null = null;

// Get environment configuration
const getEnv = (): Env => ({
	R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || '',
	CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
	R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
	R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
	R2_ENDPOINT: process.env.R2_ENDPOINT,
	LOCAL_DUCKDB_PATH: process.env.LOCAL_DUCKDB_PATH,
});

// Ensure DuckDB service is initialized
const ensureDuckDBService = async (): Promise<DuckDBService> => {
	if (!duckDBService) {
		duckDBService = new DuckDBService();
		await duckDBService.initialize(getEnv());
	}
	return duckDBService;
};

// Initialize DuckDB at startup
(async () => {
	try {
		console.log('[MCP] Initializing DuckDB...');
		await ensureDuckDBService();
		console.log('[MCP] DuckDB initialized');
	} catch (e) {
		console.error('[MCP] DuckDB initialization failed:', e);
		console.error('[MCP] Will retry on first request');
	}
})();

// Routes
app.get('/', (c) => c.text('MCP Server running. Endpoints: /query, /sse, /messages'));
app.get('/health', (c) => c.json({ status: 'healthy' }));

// Direct SQL query endpoint
app.post('/query', async (c) => {
	try {
		const { sql } = await c.req.json<{ sql: string }>();
		if (!sql) return c.json({ error: 'Missing sql' }, 400);

		const db = await ensureDuckDBService();
		const result = await db.query(sql);
		return c.json(result);
	} catch (error) {
		console.error('[Query] Error:', error);
		return c.json({
			error: 'Query failed',
			details: error instanceof Error ? error.message : String(error)
		}, 500);
	}
});

// MCP SSE endpoint
app.get('/sse', async (c) => {
	const sessionId = crypto.randomUUID();
	const db = await ensureDuckDBService();

	return streamSSE(c, async (stream) => {
		console.log(`[MCP] Connected: ${sessionId}`);

		const transport = new HonoSseTransport(async (message: JSONRPCMessage) => {
			await stream.writeSSE({ event: 'message', data: JSON.stringify(message) });
		});

		transports.set(sessionId, transport);

		try {
			const server = new McpService(db).createServer();
			await server.connect(transport);

			// Send endpoint info
			await stream.writeSSE({
				event: 'endpoint',
				data: `/messages?sessionId=${sessionId}`
			});
		} catch (err) {
			console.error('[MCP] Init error:', err);
		}

		stream.onAbort(async () => {
			console.log(`[MCP] Disconnected: ${sessionId}`);
			await transport.close();
			transports.delete(sessionId);
		});

		// Keep connection alive
		while (true) {
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
	});
});

// MCP message handler
app.post('/messages', async (c) => {
	const sessionId = c.req.query('sessionId');
	if (!sessionId) return c.text('Session ID required', 400);

	const transport = transports.get(sessionId);
	if (!transport) return c.text('Session not found', 404);

	const message = await c.req.json<JSONRPCMessage>();
	transport.handleMessage(message);
	return c.text('Accepted');
});

// Start server
const port = parseInt(process.env.PORT || '8787', 10);
console.log(`[MCP] Starting server on port ${port}`);

serve({ fetch: app.fetch, port });

export { app };
export default app;
