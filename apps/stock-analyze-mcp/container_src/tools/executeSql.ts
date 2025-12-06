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
   - Example: WHERE date >= (EXTRACT(EPOCH FROM (current_date - INTERVAL 1 MONTH)) * 1000)::BIGINT

4. Company Search Pattern (REQUIRED):
   SELECT p.*, c.name FROM stock_db.prices p
   JOIN stock_db.companies c ON p.code = c.code 
   WHERE c.name LIKE '%Toyota%'
   ORDER BY p.date DESC

4. Queries:
   - ❌ NEVER use 'SELECT *' with 'GROUP BY'.
   - ✅ For latest price: SELECT * ... ORDER BY date DESC LIMIT 1.
   - ✅ For daily history: SELECT * ... ORDER BY date DESC LIMIT 30.

5. Aggregation (Weekly/Monthly):
   - Use \`epoch_ms(date)\` to convert BIGINT to TIMESTAMP.
   - Group by \`date_trunc('week', epoch_ms(date))\` or \`date_trunc('month', ...)\`.
   - CORRECT Aggregation:
     SELECT 
       date_trunc('week', epoch_ms(date)) as week_start,
       first(open) as open, MAX(high) as high, MIN(low) as low, last(close) as close, SUM(volume) as volume
     FROM ...
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
