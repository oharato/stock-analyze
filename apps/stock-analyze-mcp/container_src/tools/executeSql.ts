import { ToolHandler, ToolDefinition } from "./types.js";
import type { DuckDBService } from "../duckdb.service.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

export class ExecuteSqlTool implements ToolHandler {
  getDefinition(): ToolDefinition {
    return {
      name: "execute_sql",
      description: "Execute a raw SQL query against the DuckDB database. The database contains 'prices' and 'fundamentals' tables in the 'stock_db' schema. prices table has columns: code, date (BIGINT ms), open, high, low, close, adjClose, volume. fundamentals table has columns: code, year, etc. ALWAYS prefix table names with 'stock_db.' (e.g. stock_db.prices).",
      inputSchema: {
        sql: z.string().describe("The DuckDB SQL query to execute."),
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
