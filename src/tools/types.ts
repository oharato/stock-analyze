import { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { DuckDBService } from "../duckdb.service.js";

export interface ToolHandler {
  getDefinition(): Tool;
  execute(args: unknown, duckDb: DuckDBService): Promise<{
    content: { type: string; text: string }[];
  }>;
}
