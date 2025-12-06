import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createMcpClient } from './lib/mcp';
import { AiService } from './services/ai';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface Env {
	AI: Ai;
	MCP_SERVER: Fetcher;
	MCP_PORT?: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
	const appUrl = 'https://stock-analyze.ohchans.com';
	const origin = c.req.header('Origin');
	const referer = c.req.header('Referer');

	// Access restriction removed for local development convenience as requested
	// const isProduction = (origin === appUrl) || (referer && referer.startsWith(appUrl));
	// const isLocal = (origin && origin.startsWith('http://localhost:')) || (referer && referer.startsWith('http://localhost:'));

	// if (!isProduction && !isLocal) {
	//    return c.json({ error: 'アクセス拒否: リクエストは stock-analyze.ohchans.com からのみ許可されています' }, 403);
	// }

	// Hand over to Hono's CORS middleware for headers, but we've already validated permission
	await next();
});

app.use('*', cors({
	origin: (origin) => {
		return origin || 'https://stock-analyze.ohchans.com';
	},
	allowMethods: ['GET', 'POST', 'OPTIONS'],
	allowHeaders: ['Content-Type'],
}));

app.post('/', async (c) => {
	let body: { question?: string; sql?: string };
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: 'Invalid JSON' }, 400);
	}

	const { question, sql } = body;

	if (!question && !sql) {
		return c.json({ error: 'Missing question or sql in request body' }, 400);
	}

	try {
		const client = await createMcpClient(c.env);

		// Direct SQL Mode
		if (sql) {
			console.log('[Direct SQL]', sql);
			try {
				const result = (await client.callTool({
					name: 'execute_sql',
					arguments: { sql },
				})) as CallToolResult;

				const content = result.content[0];
				let data = null;
				if (content.type === 'text') {
					try {
						data = JSON.parse(content.text);
					} catch { }
				}

				return c.json({
					tool_used: 'execute_sql',
					sql: sql,
					data: data || result
				});
			} catch (error) {
				return c.json({ error: String(error) }, 500);
			}
		}

		// AI Mode
		const aiService = new AiService(c.env, client);
		const result = await aiService.processQuestion(question!);

		if (result.error) {
			return c.json({ message: result.error });
		}
		return c.json(result);

	} catch (e: any) {
		return c.json({
			error: 'Internal Server Error',
			details: String(e)
		}, 500);
	}
});

export default app;
