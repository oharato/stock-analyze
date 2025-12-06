/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ServiceBindingTransport } from "./ServiceBindingTransport";

export interface Env {
	// If you set another name in the Wrangler config file as the value for 'binding',
	// replace "AI" with the variable name you defined.
	AI: Ai;
	MCP_SERVER: Fetcher;
	MCP_PORT?: string;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		// CORS ヘッダー
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// OPTIONS リクエスト（CORS プリフライト）に対応
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: corsHeaders,
			});
		}

		// POST リクエストのみ処理
		if (request.method !== 'POST') {
			return new Response(JSON.stringify({ error: 'Method not allowed' }), {
				status: 405,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// リクエストボディを解析
		let question: string;
		try {
			const body = await request.json<{ question: string }>();
			question = body.question;
		} catch (error) {
			return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		if (!question) {
			return new Response(JSON.stringify({ error: 'Missing question in request body' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}
		const transport = new ServiceBindingTransport(env.MCP_SERVER, "/sse", "", env.MCP_PORT);
		const client = new Client({ name: "worker-client", version: "1.0.0" }, { capabilities: {} });

		try {
			await client.connect(transport);

			// Example: List tools available on the MCP server
			const toolsList = await client.listTools();
			const tools = toolsList.tools;

			// 2. Construct Prompt
			const toolsDescription = tools.map(t =>
				`- ${t.name}: ${t.description}\n  Schema: ${JSON.stringify(t.inputSchema)}`
			).join('\n');

			const prompt = `
You are an intelligent assistant with access to the following tools:

${toolsDescription}

Here are some guidelines for using the tools:
- **Schema Information**:
  - \`stock_db.prices\`: \`code\` (INTEGER), \`date\` (BIGINT, ms since epoch), \`open\` (INTEGER/FLOAT), \`high\`, \`low\`, \`close\`, \`adjClose\`, \`volume\` (INTEGER).
  - \`stock_db.companies\`: \`code\` (INTEGER), \`name\` (VARCHAR), \`market\` (VARCHAR), \`sector\` (VARCHAR).
  - \`stock_db.fundamentals\`: \`code\` (INTEGER), \`date\` (BIGINT), \`revenue\`, \`profit\`, etc.
- **DO NOT** use \`get_table_schema\`. Use the schema information provided above.
- Use \`get_duckdb_functions\` to see available DuckDB functions, date formatting tips, and schema details. Use this if you need to write complex SQL involving dates (e.g. "last month").
- **IMPORTANT**: When using \`execute_sql\`, you **MUST** prefix all table names with \`stock_db.\`. For example, use \`stock_db.prices\`, \`stock_db.fundamentals\`, \`stock_db.companies\`. Do NOT use \`prices\` directly.

- **CRITICAL (Company Name Search)**: 
  - The \`prices\` table only has a \`code\` column (INTEGER), NOT a company name.
  - To search by company name, you **MUST** use LIKE search with wildcards: \`WHERE c.name LIKE '%CompanyName%'\`
  - **NEVER** use exact match (\`WHERE c.name = 'CompanyName'\`) as it will fail for partial names.
  - **ALWAYS JOIN** with \`stock_db.companies\` when filtering by company name.
  - **ALWAYS SELECT company name** (\`c.name\`) in your query so users know which company the data is for.
  - Examples:
    * "ラクーン" → \`WHERE c.name LIKE '%ラクーン%'\`
    * "トヨタ" → \`WHERE c.name LIKE '%トヨタ%'\`
    * "Apple" → \`WHERE c.name LIKE '%Apple%'\`
  - Full query example: \`SELECT p.*, c.name as company_name FROM stock_db.prices p JOIN stock_db.companies c ON p.code = c.code WHERE c.name LIKE '%ラクーン%' ORDER BY p.date DESC LIMIT 1\`

- **IMPORTANT (Dates)**: The \`prices\` table has a \`date\` column which is BIGINT (milliseconds).
  - To compare with dates, use \`epoch_ms(date)::DATE\`.
  - Use \`current_date\` for "now" or "today". **DO NOT** use \`datetime('now')\`.
  - Example (Last 1 month): \`WHERE epoch_ms(date)::DATE >= current_date - INTERVAL 1 MONTH\`
- Always prioritize using the provided tools to answer the user's question completely.

User Question: "${question}"

Decide which tool to use to answer the question.
Respond ONLY with a JSON object in the following format:
{
  "tool": "tool_name",
  "arguments": { ... }
}

If no tool is suitable, respond with:
{
  "error": "No suitable tool found."
}
`;

			// 3. Call AI
			const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
				prompt: prompt,
				max_tokens: 500,
			});

			if (!aiResponse || typeof aiResponse.response !== 'string') {
				return new Response(JSON.stringify({ error: "Invalid response from AI model" }), {
					status: 500,
					headers: { ...corsHeaders, "Content-Type": "application/json" }
				});
			}

			console.log('[AI Raw Output]', aiResponse.response);

			// 4. Parse AI Response
			let toolCall: any;
			try {
				const jsonStr = aiResponse.response.replace(/```json/g, '').replace(/```/g, '').trim();
				toolCall = JSON.parse(jsonStr);
			} catch (e) {
				console.error('Failed to parse JSON', e);
				return new Response(JSON.stringify({ error: "AI response was not valid JSON", raw: aiResponse.response }), {
					status: 500,
					headers: { ...corsHeaders, "Content-Type": "application/json" }
				});
			}

			if (toolCall.error) {
				return new Response(JSON.stringify({ message: toolCall.error }), {
					headers: { ...corsHeaders, "Content-Type": "application/json" }
				});
			}

			// 5. Execute Tool
			console.log(`[MCP] Calling tool: ${toolCall.tool}`, toolCall.arguments);
			const result = await client.callTool({
				name: toolCall.tool,
				arguments: toolCall.arguments
			}) as any;

			// 6. Return Result with metadata
			const content = result.content[0];
			if (content.type === 'text') {
				try {
					const data = JSON.parse(content.text);
					return new Response(JSON.stringify({
						question: question,
						tool_used: toolCall.tool,
						data: data
					}), {
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					});
				} catch {
					return new Response(JSON.stringify({
						question: question,
						tool_used: toolCall.tool,
						result: content.text
					}), {
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					});
				}
			}

			return new Response(JSON.stringify(result), {
				headers: { ...corsHeaders, "Content-Type": "application/json" }
			});

		} catch (error) {
			return new Response(JSON.stringify({ error: String(error) }), {
				status: 500,
				headers: { ...corsHeaders, "Content-Type": "application/json" }
			});
		}
	},
} satisfies ExportedHandler<Env>;
