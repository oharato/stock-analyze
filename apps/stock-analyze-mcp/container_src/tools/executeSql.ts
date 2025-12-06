import { ToolHandler, ToolDefinition } from "./types.js";
import type { DuckDBService } from "../duckdb.service.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

export class ExecuteSqlTool implements ToolHandler {
  getDefinition(): ToolDefinition {
    return {
      name: "execute_sql",
      description: `Execute DuckDB SQL query.

# 📖 DOMAIN KNOWLEDGE & CRITICAL RULES

## 1. Schema & Types
- **stock_db.prices**: 
  - \`code\` (INTEGER): Company ID. 
  - \`date\` (BIGINT): Milliseconds since epoch.
  - \`open\`, \`high\`, \`low\`, \`close\`, \`volume\`.
- **stock_db.companies**:
  - \`code\` (INTEGER): Company ID.
  - \`name\` (VARCHAR): Company Name (Japanese).

## 2. 🚫 STRICT PROHIBITIONS (Blacklist)
- ❌ **NO String Comparison in 'code'**: NEVER use \`code = 'Toyota'\`.
- ❌ **NO Integer Date Math**: NEVER use \`date / 1000\`, \`date % 10000\`, or \`DIV\` operator.
- ❌ **NO Direct Date Functions**: NEVER use \`EXTRACT\` or \`DATE_TRUNC\` on BIGINT date. Use \`... FROM epoch_ms(date)\`.
- ❌ **NO 'IN' Subqueries**: NEVER use \`WHERE code IN (SELECT ...)\`. use JOIN.
- ❌ **NO Parsing Translation**: Do NOT translate Japanese query to English. Use "トヨタ" as is.

## 3. ✅ MANDATORY PATTERNS (Recipes)
> 💡 **TIP**: Unsure about the syntax? Use \`get_sql_examples\` tool to get copy-paste ready SQL!

### A. Company Filtering (ALWAYS use this JOIN)
\`\`\`sql
JOIN stock_db.companies c ON CAST(p.code AS BIGINT) = CAST(c.code AS BIGINT)
WHERE c.name LIKE '%SearchTerm%'
\`\`\`

### B. Date/Aggregation
For Weekly/Monthly aggregation or complex Date filtering, **YOU MUST** use the \`get_sql_examples\` tool with \`category='weekly'\` or \`category='date'\` to get the correct \`date_trunc\` syntax.
`,
      inputSchema: {
        sql: z.string().describe("DuckDB SQL query to execute"),
      },
    };
  }

  async execute(args: unknown, duckDb: DuckDBService): Promise<CallToolResult> {
    const { sql } = args as { sql: string };
    const result = await duckDb.query(sql);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
}
