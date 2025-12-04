import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
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

    public createServer(): Server {
        const server = new Server(
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

        this.setupHandlers(server);
        return server;
    }

    private setupHandlers(server: Server): void {
        server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: this.tools.map((t) => t.getDefinition()),
            };
        });

        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            const tool = this.tools.find((t) => t.getDefinition().name === name);

            if (!tool) {
                throw new Error(`Tool not found: ${name}`);
            }

            console.log(`[McpService] Executing tool ${name}. duckDb instance exists?:`, !!this.duckDb);
            if (!this.duckDb) {
                console.error('[McpService] duckDb instance is null/undefined!');
            }

            try {
                return await tool.execute(args, this.duckDb);
            } catch (err) {
                console.error(`[McpService] Tool execution error for ${name}:`, err);
                throw err;
            }
        });
    }
}
