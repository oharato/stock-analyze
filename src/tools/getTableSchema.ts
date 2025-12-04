import { ToolHandler } from "./types.js";
import type { DuckDBService } from "../duckdb.service.js";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class GetTableSchemaTool implements ToolHandler {
  getDefinition(): Tool {
    return {
      name: "get_table_schema",
      description: "Get the schema (column names and data types) for a specific table in the database. Useful for understanding table structure before writing SQL.",
      inputSchema: {
        type: "object",
        properties: {
          table_name: { type: "string", description: "The name of the table (e.g., 'prices', 'fundamentals', 'companies')." },
        },
        required: ["table_name"],
      },
    };
  }

  async execute(args: unknown, duckDb: DuckDBService) {
    const { table_name } = args as { table_name: string };

    // Validate table_name to prevent SQL injection (only allow alphanumeric and underscores)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table_name)) {
      return {
        content: [{ type: "text", text: JSON.stringify({ error: "Invalid table name. Only alphanumeric characters and underscores are allowed." }, null, 2) }],
      };
    }

    // Query information_schema from the attached database 'stock_db'
    const sql = `
        SELECT column_name, data_type 
        FROM stock_db.information_schema.columns 
        WHERE table_name = '${table_name}'
    `;
    const result = await duckDb.query(sql);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
}
