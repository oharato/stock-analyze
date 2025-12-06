import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { Env } from "../index";

export type AiProcessResult = {
    question?: string;
    tool_used?: string;
    sql?: string;
    data?: any;
    result?: string;
    error?: string;
    description?: string; // For general messages
};

export class AiService {
    constructor(private env: Env, private client: Client) { }

    async processQuestion(question: string): Promise<AiProcessResult> {
        // 1. List tools
        const toolsList = await this.client.listTools();
        const tools = toolsList.tools;

        // 2. Build Prompt
        const toolsDescription = tools.map((t) =>
            `- ${t.name}: ${t.description}\n  Schema: ${JSON.stringify(t.inputSchema)}`
        ).join("\n");

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
        let maxTurns = 2;

        for (let turn = 0; turn < maxTurns; turn++) {
            console.log(`[AI] Turn ${turn + 1}/${maxTurns}`);

            const aiResponse = (await this.env.AI.run("@cf/meta/llama-3.1-70b-instruct" as keyof AiModels, {
                prompt: currentPrompt,
                max_tokens: 1000,
            })) as { response: string };

            if (!aiResponse || typeof aiResponse.response !== "string") {
                throw new Error("Invalid response from AI model");
            }

            console.log("[AI Raw Output]", aiResponse.response);

            // 4. Parse AI Response
            let toolCall: { tool?: string; arguments?: Record<string, unknown>; error?: string };
            try {
                let jsonStr = aiResponse.response.trim();
                const match = jsonStr.match(/```json([\s\S]*?)```/);
                if (match) {
                    jsonStr = match[1].trim();
                } else {
                    const firstBrace = jsonStr.indexOf("{");
                    const lastBrace = jsonStr.lastIndexOf("}");
                    if (firstBrace !== -1 && lastBrace !== -1) {
                        jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
                    }
                }
                toolCall = JSON.parse(jsonStr);
            } catch (e) {
                console.error("Failed to parse JSON", e);
                throw new Error("AI response was not valid JSON");
            }

            if (toolCall.error) {
                return { error: toolCall.error };
            }

            if (!toolCall.tool || !toolCall.arguments) {
                throw new Error("AI response missing 'tool' or 'arguments'");
            }

            // 5. Execute Tool
            console.log(`[MCP] Calling tool: ${toolCall.tool}`, toolCall.arguments);
            let result: CallToolResult;
            try {
                result = (await this.client.callTool({
                    name: toolCall.tool,
                    arguments: toolCall.arguments,
                })) as CallToolResult;
                console.log("[MCP] Tool result:", JSON.stringify(result, null, 2));
            } catch (error) {
                throw new Error(`Tool execution failed: ${String(error)}`);
            }

            const content = result.content[0];

            // CASE A: execute_sql completed
            if (toolCall.tool === "execute_sql") {
                if (content.type === "text") {
                    try {
                        const data = JSON.parse(content.text);
                        return {
                            question: question,
                            tool_used: toolCall.tool,
                            sql: toolCall.arguments.sql as string,
                            data: data,
                        };
                    } catch {
                        return {
                            question: question,
                            tool_used: toolCall.tool,
                            sql: toolCall.arguments.sql as string,
                            result: content.text,
                        };
                    }
                }
            }

            // CASE B: get_sql_examples completed
            if (toolCall.tool === "get_sql_examples") {
                const recipe = content.type === "text" ? content.text : JSON.stringify(content);

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
                console.log("[AI] Forced Next Prompt:", currentPrompt);
                continue; // Loop again
            }

            // CASE C: Unknown tool or other -> Return raw result
            return {
                tool_used: toolCall.tool,
                result: JSON.stringify(result),
            };
        }

        throw new Error("Max turns exceeded without final result");
    }
}
