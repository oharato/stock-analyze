import { ToolHandler, ToolDefinition } from "./types.js";
import type { DuckDBService } from "../duckdb.service.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import * as z from "zod";

export class GetEdinetDetailTool implements ToolHandler {
    getDefinition(): ToolDefinition {
        return {
            name: "get_edinet_detail",
            description: "Fetch detailed EDINET document data for a specific Document ID.",
            inputSchema: {
                doc_id: z.string().describe("EDINET Document ID (e.g. 'S100XXXX')"),
            },
        };
    }

    async execute(args: unknown, duckDb: DuckDBService): Promise<CallToolResult> {
        const { doc_id } = args as { doc_id: string };

        // Basic validation for doc_id (alphanumeric, usually 8 chars, starting with S)
        if (!/^[A-Z0-9]{8}$/.test(doc_id)) {
            throw new Error("Invalid Document ID format.");
        }

        const sql = `SELECT * FROM edinet WHERE docId = '${doc_id}'`;

        const result = await duckDb.query(sql);
        return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
    }
}
