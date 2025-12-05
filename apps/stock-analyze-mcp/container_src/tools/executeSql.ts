import { ToolHandler, ToolDefinition } from "./types.js";
import type { DuckDBService } from "../duckdb.service.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

export class ExecuteSqlTool implements ToolHandler {
  getDefinition(): ToolDefinition {
    return {
      name: "execute_sql",
      description: "Execute SQL query against DuckDB. Tables: stock_db.prices (code, date, open, high, low, close, adjClose, volume), stock_db.fundamentals, stock_db.companies. Always prefix with 'stock_db.'",
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
