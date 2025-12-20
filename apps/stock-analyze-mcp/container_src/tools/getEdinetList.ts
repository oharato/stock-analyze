import { ToolHandler, ToolDefinition } from "./types.js";
import type { DuckDBService } from "../duckdb.service.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

export class GetEdinetListTool implements ToolHandler {
    getDefinition(): ToolDefinition {
        return {
            name: "get_edinet_list",
            description: "Fetch EDINET document list and time-series data for a specific ticker symbol.",
            inputSchema: {
                ticker: z.string().describe("Stock ticker symbol (e.g. '3031')"),
            },
        };
    }

    async execute(args: unknown, duckDb: DuckDBService): Promise<CallToolResult> {
        const { ticker } = args as { ticker: string };

        // Parameterized query using DuckDB's prepared statement features or just manual escaping if simple string
        // Since DuckDBService.query takes a raw string, we must be careful.
        // However, for this MVP, simple string interpolation with basic validation is acceptable as 'ticker' is numeric-like 4 digits usually.
        // But to be safer, we can check if ticker matches 4 digit pattern.
        if (!/^\d{4}$/.test(ticker)) {
            throw new Error("Invalid ticker format. Must be 4 digits.");
        }

        const sql = `
      SELECT year, date, docId as doc_id, net_sales, operating_income, net_income, earnings_per_share 
      FROM edinet 
      WHERE code = '${ticker}' 
      ORDER BY year ASC
    `;

        const result = await duckDb.query(sql);
        return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
    }
}
