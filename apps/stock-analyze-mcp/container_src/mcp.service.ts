import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DuckDBService } from "./duckdb.service.js";
import { ToolHandler } from "./tools/types.js";
import { ExecuteSqlTool } from "./tools/executeSql.js";
import { GetTableSchemaTool } from "./tools/getTableSchema.js";
import { GetDuckDbFunctionsTool } from "./tools/getDuckDbFunctions.js";

export class McpService {
    private tools: ToolHandler[];

    constructor(private duckDb: DuckDBService) {
        this.tools = [
            new ExecuteSqlTool(),
            new GetTableSchemaTool(),
            new GetDuckDbFunctionsTool(),
        ];
    }

    public createServer(): McpServer {
        const server = new McpServer(
            {
                name: "stock-analyze-mcp-server-container",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        // Register each tool using the new McpServer API
        for (const tool of this.tools) {
            const definition = tool.getDefinition();

            server.registerTool(
                definition.name,
                {
                    description: definition.description,
                    inputSchema: definition.inputSchema,
                },
                async (args: any) => {
                    try {
                        return await tool.execute(args, this.duckDb);
                    } catch (err) {
                        console.error(`[McpService] Tool execution error for ${definition.name}:`, err);
                        throw err;
                    }
                }
            );
        }

        return server;
    }
}
