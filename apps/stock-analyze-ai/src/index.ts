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
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface Env {
	// If you set another name in the Wrangler config file as the value for 'binding',
	// replace "AI" with the variable name you defined.
	AI: Ai;
	MCP_SERVER: Fetcher;
	MCP_PORT?: string;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const origin = request.headers.get('Origin');
		const referer = request.headers.get('Referer');

		const allowedOrigins = ['https://stock-analyze.ohchans.com'];
		const isProduction = allowedOrigins.includes(origin || '') || (referer && allowedOrigins.some(o => referer.startsWith(o)));
		const isLocal = (origin && origin.startsWith('http://localhost:')) || (referer && referer.startsWith('http://localhost:'));

		const isAllowed = isProduction || isLocal;

		// CORS ヘッダー
		const corsHeaders = {
			'Access-Control-Allow-Origin': isAllowed ? (origin || 'https://stock-analyze.ohchans.com') : 'https://stock-analyze.ohchans.com',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		// OPTIONS リクエスト（CORS プリフライト）に対応
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: corsHeaders,
			});
		}

		// 許可されていないオリジンからのリクエストを拒否
		if (!isAllowed) {
			// Origin/Referer がない場合（curl等）も、厳密に制限する場合は拒否する
			// ただし、開発中の利便性を考慮して完全にブロックするかは要検討だが、
			// ユーザーの要件「stock-analyze.ohchans.com からのリクエストに限定」に従いブロックする。
			return new Response(JSON.stringify({ error: 'アクセス拒否: リクエストは stock-analyze.ohchans.com からのみ許可されています' }), {
				status: 403,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
				let result: CallToolResult;
				try {
					result = (await client.callTool({
						name: toolCall.tool,
						arguments: toolCall.arguments
					})) as CallToolResult;
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

			// 2. プロンプトの構築
			const toolsDescription = tools.map(t =>
				`- ${t.name}: ${t.description}\n  Schema: ${JSON.stringify(t.inputSchema)}`
			).join('\n');

			const prompt = `
You are an intelligent assistant with access to the following tools:

${toolsDescription}

Here are some guidelines for using the tools:

# 🛡️ CRITICAL RULES (OVERRIDE YOUR DEFAULT KNOWLEDGE)

## 1. 🛑 STOP & CHECK
If the user's question involves:
- **"Weekly" / "Monthly" / "Chart"**
- **Date Filtering (e.g. "2025")**
- **Company Search (e.g. "Toyota")**

You **MUST** call the \`get_sql_examples\` tool FIRST to get the correct SQL recipe.
(UNLESS you have already called it in this conversation and have the recipe).
**DO NOT** try to write SQL from scratch for these cases.

## 2. 🚫 STRICT PROHIBITIONS
Even if you think you know SQL, you must **NEVER** do the following in this environment:
- ❌ \`date / 1000\` or \`date + INTERVAL\` (Date is BIGINT!)
- ❌ \`code = 'Toyota'\` (Code is INTEGER! Use JOIN)
- ❌ \`WHERE code IN (SELECT ...)\` (Use JOIN)
- ❌ \`FROM epoch_ms(...)\` (Syntax Error! Use \`epoch_ms(...)\` directly)
- ❌ \`epoch_ms('2025-01-01')\` (Error! You MUST cast to TIMESTAMP: \`epoch_ms('2025-01-01'::TIMESTAMP)\`)

## 3. ✅ HOW TO SUCCEED
1. Call \`get_sql_examples({ category: 'weekly' })\` (or 'company'/'date').
2. Read the returned SQL recipe.
3. Replace the placeholder (e.g. '%SearchTerm%') with the User's input (Keep Japanese!).
4. Call \`execute_sql\` with the adapted recipe.

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

			// 3. AI Interaction Loop
			let currentPrompt = prompt;
			let maxTurns = 2; // Allow at least: get_examples -> execute_sql

			for (let turn = 0; turn < maxTurns; turn++) {
				console.log(`[AI] Turn ${turn + 1}/${maxTurns}`);

				const aiResponse = await env.AI.run('@cf/meta/llama-3.1-70b-instruct' as keyof AiModels, {
					prompt: currentPrompt,
					max_tokens: 1000,
				}) as { response: string };

				if (!aiResponse || typeof aiResponse.response !== 'string') {
					throw new Error("Invalid response from AI model");
				}

				console.log('[AI Raw Output]', aiResponse.response);

				// 4. Parse AI Response
				let toolCall: { tool?: string; arguments?: Record<string, unknown>; error?: string };
				try {
					let jsonStr = aiResponse.response.trim();
					const match = jsonStr.match(/```json([\s\S]*?)```/);
					if (match) {
						jsonStr = match[1].trim();
					} else {
						const firstBrace = jsonStr.indexOf('{');
						const lastBrace = jsonStr.lastIndexOf('}');
						if (firstBrace !== -1 && lastBrace !== -1) {
							jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
						}
					}
					toolCall = JSON.parse(jsonStr);
				} catch (e) {
					console.error('Failed to parse JSON', e);
					throw new Error("AI response was not valid JSON");
				}

				if (toolCall.error) {
					return new Response(JSON.stringify({ message: toolCall.error }), {
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					});
				}

				if (!toolCall.tool || !toolCall.arguments) {
					throw new Error("AI response missing 'tool' or 'arguments'");
				}

				// 5. Execute Tool
				console.log(`[MCP] Calling tool: ${toolCall.tool}`, toolCall.arguments);
				let result: CallToolResult;
				try {
					result = (await client.callTool({
						name: toolCall.tool,
						arguments: toolCall.arguments
					})) as CallToolResult;
					console.log('[MCP] Tool result:', JSON.stringify(result, null, 2));
				} catch (error) {
					// 省略せず詳細を返す
					return new Response(JSON.stringify({
						error: 'Tool execution failed',
						details: String(error)
					}), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
				}

				const content = result.content[0];

				// CASE A: execute_sql completed -> Return Data
				if (toolCall.tool === 'execute_sql') {
					if (content.type === 'text') {
						try {
							const data = JSON.parse(content.text);
							return new Response(JSON.stringify({
								question: question,
								tool_used: toolCall.tool,
								sql: toolCall.arguments.sql,
								data: data
							}), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
						} catch {
							// JSONパース失敗時はテキストとして返す
							return new Response(JSON.stringify({
								question: question,
								tool_used: toolCall.tool,
								sql: toolCall.arguments.sql,
								result: content.text
							}), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
						}
					}
				}

				// CASE B: get_sql_examples completed -> Force Next Step with Fresh Prompt
				if (toolCall.tool === 'get_sql_examples') {
					const recipe = content.type === 'text' ? content.text : JSON.stringify(content);

					// 履歴を積むのではなく、新しい強力なプロンプトで上書きする
					currentPrompt = `
You are a SQL Expert.
You have received a mandatory SQL recipe.

# RECIPE:
${recipe}

# INSTRUCTION:
1. Use the recipe above EXACTLY.
2. Replace '%SEARCH_TERM%' with the user's query: "${question}"
3. Call the \`execute_sql\` tool.

Response Format:
{
  "tool": "execute_sql",
  "arguments": {
    "sql": "..."
  }
}
`;
					console.log('[AI] Forced Next Prompt:', currentPrompt);
					continue; // Loop again with the new FORCED prompt
				}

				// CASE C: Unknown tool or other -> Return raw result
				return new Response(JSON.stringify(result), {
					headers: { ...corsHeaders, "Content-Type": "application/json" }
				});
			}

			throw new Error("Max turns exceeded without final result");

		} catch (error) {
			return new Response(JSON.stringify({ error: String(error) }), {
				status: 500,
				headers: { ...corsHeaders, "Content-Type": "application/json" }
			});
		}
	},
} satisfies ExportedHandler<Env>;
