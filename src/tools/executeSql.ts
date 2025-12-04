import { ToolHandler } from "./types.js";
import type { DuckDBService } from "../duckdb.service.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class ExecuteSqlTool implements ToolHandler {
  getDefinition(): Tool {
    return {
      name: "execute_sql",
      description: "Execute a raw SQL query against the DuckDB database. The database contains 'prices' and 'fundamentals' tables in the 'stock_db' schema. prices table has columns: code, date (BIGINT ms), open, high, low, close, adjClose, volume. fundamentals table has columns: code, year, etc. ALWAYS prefix table names with 'stock_db.' (e.g. stock_db.prices).",
      inputSchema: {
        type: "object",
        properties: {
          sql: { type: "string", description: "The DuckDB SQL query to execute." },
        },
        required: ["sql"],
      },
    };
  }

  async execute(args: unknown, duckDb: DuckDBService) {
    const { sql } = args as { sql: string };
    const result = await duckDb.query(sql);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
}
