import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { streamSSE } from 'hono/streaming';
import { config } from 'dotenv';
import { DuckDBService, Env } from './duckdb.service.js';
import { McpService } from './mcp.service.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { HonoSseTransport } from './hono-transports.js';

// Load environment variables from .env file.
config();

const app = new Hono();

// State persistence requires Durable Objects or keeping instances in memory
const transports = new Map<string, HonoSseTransport>();
let duckDBService: DuckDBService | null = null;

console.log('[MCP Container] Starting index.ts...');

// Get environment from process.env
function getEnv(): Env {
	return {
		R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || '',
		CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
		R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
		R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
		R2_ENDPOINT: process.env.R2_ENDPOINT,
		LOCAL_DUCKDB_PATH: process.env.LOCAL_DUCKDB_PATH,
	};
}

// Ensure DuckDB service is initialized (lazy init fallback)
async function ensureDuckDBService(): Promise<DuckDBService> {
	if (!duckDBService) {
		duckDBService = new DuckDBService();
		await duckDBService.initialize(getEnv());
	}
	return duckDBService;
}

// Initialize DuckDB service at startup
(async () => {
	try {
		console.log('[MCP Container] Initializing DuckDB service at startup...');
		await ensureDuckDBService();
		console.log('[MCP Container] DuckDB service initialized successfully');
	} catch (e) {
		console.error('[MCP Container] Failed to initialize DuckDB at startup:', e);
		console.error('[MCP Container] Service will attempt lazy initialization on first request');
	}
})();

app.get('/', (c) => {
	return c.text('MCP Server (Container) is running! Available endpoints: /query, /sse, /messages');
});

// Health check endpoint for container orchestration
app.get('/health', (c) => {
	return c.json({ status: 'healthy' });
});

// Direct query endpoint
app.post('/query', async (c) => {
	try {
		const { sql } = await c.req.json<{ sql: string }>();
		if (!sql) {
			return c.json({ error: 'Missing sql in request body' }, 400);
		}

		const dbService = await ensureDuckDBService();
		const result = await dbService.query(sql);
		return c.json(result);
	} catch (error: unknown) {
		console.error('Query execution error:', error);
		const errorDetails = error instanceof Error ? error.message : String(error);
		return c.json({ error: 'Failed to execute query', details: errorDetails }, 500);
	}
});

// MCP SSE endpoint
app.get('/sse', async (c) => {
	console.log('[MCP Container] SSE request received');
	const sessionId = crypto.randomUUID();

	const dbService = await ensureDuckDBService();

	return streamSSE(c, async (stream) => {
		console.log(`[MCP] New connection: ${sessionId}`);

		const transport = new HonoSseTransport(async (message: JSONRPCMessage) => {
			await stream.writeSSE({
				event: 'message',
				data: JSON.stringify(message)
			});
		});

		transports.set(sessionId, transport);

		try {
			const mcpService = new McpService(dbService);
			const server = mcpService.createServer();
			await server.connect(transport);
			console.log(`[MCP] Server connected for ${sessionId}`);

			// Initial endpoint notification
			console.log(`[MCP] Sending endpoint event for ${sessionId}`);
			await stream.writeSSE({
				event: 'endpoint',
				data: `/messages?sessionId=${sessionId}`
			});
			console.log(`[MCP] Endpoint event sent for ${sessionId}`);
		} catch (err: unknown) {
			console.error('Initialization error inside SSE:', err);
		}

		stream.onAbort(async () => {
			console.log(`[MCP] Connection closed: ${sessionId}`);
			await transport.close();
			transports.delete(sessionId);
		});

		// Keep connection open
		while (true) {
			await new Promise(resolve => setTimeout(resolve, 1000));
		}
	});
});

// MCP Messages endpoint
app.post('/messages', async (c) => {
	const sessionId = c.req.query('sessionId');
	if (!sessionId) {
		return c.text('Session ID required', 400);
	}

	const transport = transports.get(sessionId);
	if (!transport) {
		return c.text('Session not found', 404);
	}

	const body = await c.req.json();
	transport.handleMessage(body);
	return c.text('Accepted');
});

const port = parseInt(process.env.PORT || '8787', 10);
console.log(`Starting MCP Server (Container) on port ${port}`);

serve({
	fetch: app.fetch,
	port
});

export { app };
export default app;
