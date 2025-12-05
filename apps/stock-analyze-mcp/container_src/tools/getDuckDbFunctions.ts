import { ToolHandler, ToolDefinition } from "./types.js";
import type { DuckDBService } from "../duckdb.service.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class GetDuckDbFunctionsTool implements ToolHandler {
  getDefinition(): ToolDefinition {
    return {
      name: "get_duckdb_functions",
      description: "Get DuckDB functions, date formatting tips, and schema info for writing valid SQL.",
      inputSchema: {},
    };
  }

  async execute(_args: unknown, _duckDb: DuckDBService): Promise<CallToolResult> {
    const info = `
**DuckDB Quick Reference**

**Date/Time:**
- 'date' column is BIGINT (ms since epoch)
- Convert: epoch_ms(date)::DATE
- Current: current_date
- Arithmetic: current_date - INTERVAL 1 MONTH
- Format: strftime(date_col, '%Y-%m-%d')

**Schema:**
- Tables: stock_db.prices, stock_db.fundamentals, stock_db.companies
- Always prefix with 'stock_db.'

**Common Errors:**
- ❌ date::DATE (wrong)
- ✅ epoch_ms(date)::DATE (correct)
- Use execute_sql for complex queries with date math

**Example:**
SELECT * FROM stock_db.prices 
WHERE code='1301' AND epoch_ms(date)::DATE >= current_date - INTERVAL 7 DAY;
`;
    return {
      content: [{ type: "text" as const, text: info }],
    };
  }
}
