import { ToolHandler, ToolDefinition } from "./types.js";
import type { DuckDBService } from "../duckdb.service.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

export class GetTableSchemaTool implements ToolHandler {
  getDefinition(): ToolDefinition {
    return {
      name: "get_table_schema",
      description: "Get the schema (column names and data types) for a specific table in the database. Useful for understanding table structure before writing SQL.",
      inputSchema: {
        table_name: z.string().describe("The name of the table to inspect (e.g., 'prices', 'fundamentals', 'companies')."),
      },
    };
  }

  async execute(args: unknown, duckDb: DuckDBService): Promise<CallToolResult> {
    const { table_name } = args as { table_name: string };

    // Validate table_name to prevent SQL injection (only allow alphanumeric and underscores)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table_name)) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ error: "Invalid table name. Only alphanumeric characters and underscores are allowed." }, null, 2) }],
      };
    }

    // Use DESCRIBE to get table schema, ensuring we look at the attached stock_db
    const sql = `DESCRIBE stock_db.${table_name}`;
    const result = await duckDb.query(sql);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
}
