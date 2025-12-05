import type { DuckDBService } from "../duckdb.service.js";
import type { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// Custom tool definition that supports Zod schemas
export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, z.ZodTypeAny>;
}

export interface ToolHandler {
  getDefinition(): ToolDefinition;
  execute(args: unknown, duckDb: DuckDBService): Promise<CallToolResult>;
}
