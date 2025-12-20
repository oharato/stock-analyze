import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DuckDBService } from "./duckdb.service.js";
import { ToolHandler } from "./tools/types.js";
import { ExecuteSqlTool } from "./tools/executeSql.js";
import { GetTableSchemaTool } from "./tools/getTableSchema.js";
import { GetDuckDbFunctionsTool } from "./tools/getDuckDbFunctions.js";
import { GetSqlExamplesTool } from "./tools/getSqlExamples.js";
import { GetEdinetListTool } from "./tools/getEdinetList.js";
import { GetEdinetDetailTool } from "./tools/getEdinetDetail.js";

export class McpService {
    private readonly tools: ToolHandler[] = [
        new ExecuteSqlTool(),
        new GetTableSchemaTool(),
        new GetDuckDbFunctionsTool(),
        new GetSqlExamplesTool(),
        new GetEdinetListTool(),
        new GetEdinetDetailTool(),
    ];

    constructor(private readonly duckDb: DuckDBService) {
        console.log("I AM THE NEW CODE 2025-12-20");
    }

    public createServer(): McpServer {
        const server = new McpServer(
            { name: "stock-analyze-mcp", version: "1.0.0" },
            { capabilities: { tools: {} } }
        );

        // Register all tools (Rebuild Trigger 4)
        console.log(`[McpService] Total tools: ${this.tools.length}`);
        console.log(`[McpService] Tools: ${this.tools.map(t => t.getDefinition().name).join(', ')}`);

        this.tools.forEach(tool => {
            const { name, description, inputSchema } = tool.getDefinition();
            console.log(`[McpService] Registering tool: ${name}`);

            server.registerTool(
                name,
                { description, inputSchema },
                async (args: any) => {
                    try {
                        return await tool.execute(args, this.duckDb);
                    } catch (err) {
                        console.error(`[Tool:${name}] Error:`, err);
                        throw err;
                    }
                }
            );
        });

        return server;
    }
}
