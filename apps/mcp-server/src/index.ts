import { Container, getContainer } from "@cloudflare/containers";
import { Hono } from "hono";

interface Env {
    MCP_SERVER: DurableObjectNamespace<McpServer>;
    R2_ENDPOINT: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    CLOUDFLARE_ACCOUNT_ID: string;
    R2_BUCKET_NAME: string;
}

export class McpServer extends Container<Env> {
    // Port the container listens on (must match the port in Dockerfile/index.ts)
    defaultPort = 8787;
    // Time before container sleeps due to inactivity
    sleepAfter = "10m";
    envVars = {
        R2_ENDPOINT: this.env.R2_ENDPOINT,
        R2_ACCESS_KEY_ID: this.env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: this.env.R2_SECRET_ACCESS_KEY,
        CLOUDFLARE_ACCOUNT_ID: this.env.CLOUDFLARE_ACCOUNT_ID,
        R2_BUCKET_NAME: this.env.R2_BUCKET_NAME
    };

    // Optional: Allow internet access if needed (e.g. for R2 or external APIs)
    enableInternet = true;
}

const app = new Hono<{ Bindings: Env }>();

app.all("*", async (c) => {
    // Route all requests to a singleton container instance named "mcp-server"
    const container = getContainer(c.env.MCP_SERVER, "mcp-server");
    return await container.fetch(c.req.raw);
});

export default app;
