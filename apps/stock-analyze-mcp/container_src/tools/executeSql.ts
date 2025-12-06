import { ToolHandler, ToolDefinition } from "./types.js";
import type { DuckDBService } from "../duckdb.service.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

export class ExecuteSqlTool implements ToolHandler {
  getDefinition(): ToolDefinition {
    return {
      name: "execute_sql",
      description: `Execute SQL query against DuckDB.
      
Schema Information:
- stock_db.prices: code (INT), date (BIGINT ms since epoch), open, high, low, close, adjClose, volume.
- stock_db.companies: code (INT), name (VARCHAR), market, sector.

IMPORTANT Rules:
1. Always prefix tables with 'stock_db.' (e.g., stock_db.prices).
2. 'code' column is INTEGER. 
   - ❌ NEVER use string like "Toyota" in 'code' column.
   - ✅ ALWAYS JOIN 'stock_db.companies' to filter by name.

3. 'date' column is BIGINT (milliseconds since epoch). 
   - ❌ NEVER treat 'date' as YYYYMMDD integer (e.g. date / 10000).
   - ❌ NEVER use integer math on 'date' for filtering.
   - ✅ To filter by date: convert target date to EPOCH MS.
   - Example (Specific Date): WHERE date >= (EXTRACT(EPOCH FROM TIMESTAMP '2025-01-01') * 1000)::BIGINT
   - Example (Range): WHERE date BETWEEN (EXTRACT(EPOCH FROM TIMESTAMP '2025-01-01') * 1000)::BIGINT AND (EXTRACT(EPOCH FROM TIMESTAMP '2025-12-31') * 1000)::BIGINT

4. Company Search Pattern (REQUIRED):
   SELECT p.*, c.name FROM stock_db.prices p
   JOIN stock_db.companies c ON CAST(p.code AS BIGINT) = CAST(c.code AS BIGINT) 
   WHERE c.name LIKE '%Toyota%'
   ORDER BY p.date DESC
   - ❌ NEVER use 'IN' subquery (e.g. WHERE code IN (SELECT...)).
   - ❌ NEVER use 'DIV' operator.

4. Queries:
   - ❌ NEVER use 'SELECT *' with 'GROUP BY'.
   - ✅ For latest price: SELECT * ... ORDER BY date DESC LIMIT 1.
   - ✅ For daily history: SELECT * ... ORDER BY date DESC LIMIT 30.

5. Aggregation (Weekly/Monthly):
   - Use \`epoch_ms(date)\` to convert BIGINT to TIMESTAMP.
   - ❌ NEVER use integer math (e.g. date / 1000, date DIV 604800).
   - ✅ ALWAYS use \`date_trunc\`.
   - Group by \`date_trunc('week', epoch_ms(date))\` or \`date_trunc('month', ...)\`.
   - CORRECT Aggregation Pattern (Weekly):
     SELECT 
       date_trunc('week', epoch_ms(p.date)) as week_start,
       first(p.open) as open, MAX(p.high) as high, MIN(p.low) as low, last(p.close) as close, SUM(p.volume) as volume
     FROM stock_db.prices p
     JOIN stock_db.companies c ON CAST(p.code AS BIGINT) = CAST(c.code AS BIGINT)
     WHERE c.name LIKE '%Toyota%'
     GROUP BY 1
     ORDER BY 1 DESC`,
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
