import { ToolHandler, ToolDefinition } from "./types.js";
import type { DuckDBService } from "../duckdb.service.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

export class GetSqlExamplesTool implements ToolHandler {
    getDefinition(): ToolDefinition {
        return {
            name: "get_sql_examples",
            description: `Returns APPROVED SQL templates and recipes for DuckDB.
Use this tool BEFORE writing complex SQL queries to ensure you use the correct syntax, schema, and best practices.

Supported Categories:
- 'weekly': Weekly/Monthly aggregation with date_trunc.
- 'company': Searching companies by Japanese name.
- 'date': Valid date filtering with TIMESTAMP casting.
- 'all': Returns all examples.`,
            inputSchema: {
                category: z.enum(['weekly', 'company', 'date', 'all'])
                    .describe("Category of SQL examples to retrieve"),
            },
        };
    }

    async execute(args: unknown, _duckDb: DuckDBService): Promise<CallToolResult> {
        const { category } = args as { category: 'weekly' | 'company' | 'date' | 'all' };

        const examples: Record<string, string> = {
            weekly: `
### Weekly/Monthly Aggregation Recipe
-- ❌ NEVER use 'DIV' or integer math on date
-- ❌ NEVER use 'FROM epoch_ms' (Syntax Error)
-- ✅ USE date_trunc and epoch_ms directly
SELECT 
  c.name,
  date_trunc('week', epoch_ms(p.date)) as week_start,
  arg_min(p.open, p.date) as open, 
  MAX(p.high) as high, 
  MIN(p.low) as low, 
  arg_max(p.close, p.date) as close, 
  SUM(p.volume) as volume
FROM stock_db.prices p
JOIN stock_db.companies c ON CAST(p.code AS BIGINT) = CAST(c.code AS BIGINT)
WHERE c.code = (
    -- 🎯 Subquery to pick the SINGLE company with smallest code
    SELECT code FROM stock_db.companies 
    WHERE name LIKE '%SEARCH_TERM%' 
    ORDER BY CAST(code AS INTEGER) ASC 
    LIMIT 1
  )
  AND p.date >= (EXTRACT(EPOCH FROM TIMESTAMP '2025-01-01')*1000)::BIGINT
GROUP BY c.name, c.code, date_trunc('week', epoch_ms(p.date))
ORDER BY week_start DESC;
`,
            company: `
### Company Search Recipe
-- ❌ NEVER use 'IN' subquery
-- ✅ USE explicit JOIN with CAST
SELECT p.*, c.name FROM stock_db.prices p
JOIN stock_db.companies c ON CAST(p.code AS BIGINT) = CAST(c.code AS BIGINT) 
WHERE c.name LIKE '%SEARCH_TERM%' -- ⚠️ REPLACE with User's Query (Japanese)
ORDER BY p.date DESC
LIMIT 30;
`,
            date: `
### Date Filtering Recipe
-- ❌ NEVER use date / 1000
-- ✅ USE TIMESTAMP casting
WHERE p.date >= (EXTRACT(EPOCH FROM TIMESTAMP '2025-01-01') * 1000)::BIGINT
  AND p.date <= (EXTRACT(EPOCH FROM TIMESTAMP '2025-12-31') * 1000)::BIGINT;
`
        };

        let resultText = "";
        if (category === 'all') {
            resultText = Object.values(examples).join("\n\n---\n\n");
        } else {
            resultText = examples[category];
        }

        return {
            content: [{ type: "text", text: resultText }],
        };
    }
}
