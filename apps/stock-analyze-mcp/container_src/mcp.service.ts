import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DuckDBService } from "./duckdb.service.js";
import { ToolHandler } from "./tools/types.js";
import { ExecuteSqlTool } from "./tools/executeSql.js";
import { GetTableSchemaTool } from "./tools/getTableSchema.js";
import { GetDuckDbFunctionsTool } from "./tools/getDuckDbFunctions.js";

export class McpService {
    private readonly tools: ToolHandler[] = [
        new ExecuteSqlTool(),
        new GetTableSchemaTool(),
        new GetDuckDbFunctionsTool(),
    ];

    constructor(private readonly duckDb: DuckDBService) { }

    public createServer(): McpServer {
        const server = new McpServer(
            { name: "stock-analyze-mcp", version: "1.0.0" },
            { capabilities: { tools: {} } }
        );

        // Register all tools
        this.tools.forEach(tool => {
            const { name, description, inputSchema } = tool.getDefinition();

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
