import { ToolHandler, ToolDefinition } from "./types.js";
import type { DuckDBService } from "../duckdb.service.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class GetDuckDbFunctionsTool implements ToolHandler {
  getDefinition(): ToolDefinition {
    return {
      name: "get_duckdb_functions",
      description: "Returns a list of useful DuckDB functions, date formatting tips, and schema information to help write valid SQL queries.",
      inputSchema: {}, // No input parameters needed
    };
  }

  async execute(_args: unknown, _duckDb: DuckDBService): Promise<CallToolResult> {
    const info = `
**DuckDB Context & Useful Functions**

1. **Date/Time Handling:**
   - The 'date' column in 'prices' is BIGINT (milliseconds since epoch).
   - Convert to DATE: \`epoch_ms(date)::DATE\`
   - Current Date: \`current_date\`
   - Date Arithmetic: \`current_date - INTERVAL 1 MONTH\`
   - Formatting: \`strftime(date_col, '%Y-%m-%d')\`

2. **Schema Information:**
   - All tables are in the 'stock_db' schema.
   - Tables: \`stock_db.prices\`, \`stock_db.fundamentals\`, \`stock_db.companies\`.
   - Always prefix tables with \`stock_db.\`.

3. **Common Errors to Avoid:**
   - Do NOT cast BIGINT directly to DATE (e.g. \`date::DATE\`). Use \`epoch_ms(date)::DATE\`.
   - Do NOT use SQL functions (like \`date_sub\`) inside string parameters for tools like \`get_stock_prices\`. Use \`execute_sql\` for complex queries involving date math.

4. **Example Query:**
   \`SELECT * FROM stock_db.prices WHERE code='1301' AND epoch_ms(date)::DATE >= current_date - INTERVAL 7 DAY;\`
`;
    return {
      content: [{ type: "text" as const, text: info }],
    };
  }
}
