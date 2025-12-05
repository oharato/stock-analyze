import { ToolHandler, ToolDefinition } from "./types.js";
import type { DuckDBService } from "../duckdb.service.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

export class GetTableSchemaTool implements ToolHandler {
  getDefinition(): ToolDefinition {
    return {
      name: "get_table_schema",
      description: "Get schema (columns and types) for a table. Useful before writing SQL.",
      inputSchema: {
        table_name: z.string().describe("Table name (e.g., 'prices', 'fundamentals', 'companies')"),
      },
    };
  }

  async execute(args: unknown, duckDb: DuckDBService): Promise<CallToolResult> {
    const { table_name } = args as { table_name: string };

    // Validate table name (alphanumeric and underscores only)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table_name)) {
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ error: "Invalid table name" }, null, 2)
        }],
      };
    }

    const result = await duckDb.query(`DESCRIBE stock_db.${table_name}`);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
}
