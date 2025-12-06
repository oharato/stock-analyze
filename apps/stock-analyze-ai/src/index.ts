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
		let question: string | undefined;
		let sql: string | undefined;

		try {
			const body = await request.json<{ question?: string; sql?: string }>();
			question = body.question;
			sql = body.sql;
		} catch (error) {
			return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		if (!question && !sql) {
			return new Response(JSON.stringify({ error: 'Missing question or sql in request body' }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		const transport = new ServiceBindingTransport(env.MCP_SERVER, "/sse", "", env.MCP_PORT);
		const client = new Client({ name: "worker-client", version: "1.0.0" }, { capabilities: {} });

		try {
			await client.connect(transport);

			// SQL が直接指定された場合（SQL モード）
			if (sql) {
				console.log('[Direct SQL]', sql);
				const toolCall = {
					tool: 'execute_sql',
					arguments: { sql },
				};

				// ツール実行
				let result: any;
				try {
					result = await client.callTool({
						name: toolCall.tool,
						arguments: toolCall.arguments
					});
				} catch (error) {
					// 省略: エラーハンドリング（下流で共通化しても良いが、ここではシンプルに返す）
					return new Response(JSON.stringify({ error: String(error) }), {
						status: 500,
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					});
				}

				// 結果の整形
				const content = result.content[0];
				let data = null;
				if (content.type === 'text') {
					try {
						data = JSON.parse(content.text);
					} catch { }
				}

				return new Response(JSON.stringify({
					tool_used: 'execute_sql',
					sql: sql,
					data: data || result
				}), {
					headers: { ...corsHeaders, "Content-Type": "application/json" }
				});
			}

			// 以下、質問 (question) がある場合の AI 処理
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
- **CRITICAL**: You MUST follow the schema and rules defined in the tool descriptions above.
- **CRITICAL**: Do NOT hallucinate column names or SQL syntax. Use ONLY what is described.
- **CRITICAL**: Respond ONLY with valid JSON. Do not include any explanations or extra text outside the JSON block.

**SQL RULES ENFORCEMENT:**
1. **DATE Filtering**: The \`date\` column is BIGINT (milliseconds). 
   - ❌ NEVER use integer math like \`date / 10000\`. 
   - ✅ USE \`(EXTRACT(EPOCH FROM TIMESTAMP '2025-01-01')*1000)::BIGINT\`.
2. **Company Code**: The \`code\` column is INTEGER.
   - ❌ NEVER uses strings like \`code = 'Toyota'\`.
   - ✅ ALWAYS JOIN \`stock_db.companies\` table.
   - ⚠️ **NAME MATCHING**: Use the **Original Japanese Name** from the user's question. Do NOT translate "トヨタ" to "Toyota".
     - Bad: LIKE '%Toyota Motor Corporation%'
     - Good: LIKE '%トヨタ%'

3. **Weekly/Monthly Aggregation Recipe (Use this Pattern)**:
   \`\`\`sql
   SELECT 
     date_trunc('week', epoch_ms(p.date)) as week_start,
     first(p.open) as open, MAX(p.high) as high, MIN(p.low) as low, last(p.close) as close, SUM(p.volume) as volume
   FROM stock_db.prices p
   JOIN stock_db.companies c ON CAST(p.code AS BIGINT) = CAST(c.code AS BIGINT)
   WHERE c.name LIKE '%QueryName%'
     AND p.date >= (EXTRACT(EPOCH FROM TIMESTAMP '2025-01-01')*1000)::BIGINT
   GROUP BY 1
   ORDER BY 1 DESC
   \`\`\`

User Question: "${question}"

Decide which tool to use to answer the question.
If the question is about stock prices, execute_sql is usually the best tool.
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
				let jsonStr = aiResponse.response.trim();
				// マークダウンのコードブロックがあれば、その中身だけを取り出す
				const match = jsonStr.match(/```json([\s\S]*?)```/);
				if (match) {
					jsonStr = match[1].trim();
				} else {
					// コードブロックがない場合、最初の { から 最後の } までを取り出す
					const firstBrace = jsonStr.indexOf('{');
					const lastBrace = jsonStr.lastIndexOf('}');
					if (firstBrace !== -1 && lastBrace !== -1) {
						jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
					}
				}
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

			let result: any;
			try {
				result = await client.callTool({
					name: toolCall.tool,
					arguments: toolCall.arguments
				});
				console.log('[MCP] Tool result:', JSON.stringify(result, null, 2));
			} catch (error) {
				console.error('[MCP] Tool execution failed:', error);
				return new Response(JSON.stringify({
					error: 'Tool execution failed',
					details: String(error)
				}), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}

			// 6. Return Result with metadata
			if (!result || !result.content || !Array.isArray(result.content) || result.content.length === 0) {
				console.error('[MCP] Invalid result structure:', result);
				return new Response(JSON.stringify({
					error: 'Invalid result from MCP server',
					result: result
				}), {
					status: 500,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' }
				});
			}

			const content = result.content[0];
			if (content.type === 'text') {
				try {
					const data = JSON.parse(content.text);
					return new Response(JSON.stringify({
						question: question,
						tool_used: toolCall.tool,
						sql: toolCall.arguments.sql,  // SQL を追加
						data: data
					}), {
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					});
				} catch {
					return new Response(JSON.stringify({
						question: question,
						tool_used: toolCall.tool,
						sql: toolCall.arguments.sql,  // SQL を追加
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
