import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ServiceBindingTransport } from "../ServiceBindingTransport";
import { Env } from "../index";

export const createMcpClient = async (env: Env) => {
    const transport = new ServiceBindingTransport(env.MCP_SERVER, "/sse", "", env.MCP_PORT);
    const client = new Client({ name: "worker-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    return client;
};
