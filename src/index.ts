import { Container, getContainer } from "@cloudflare/containers";
import { Hono } from "hono";

interface Env {
    MY_CONTAINER: DurableObjectNamespace<MyContainer>;
}

export class MyContainer extends Container<Env> {
    // Port the container listens on (must match the port in Dockerfile/index.ts)
    defaultPort = 8787;
    // Time before container sleeps due to inactivity
    sleepAfter = "10m";

    // Optional: Allow internet access if needed (e.g. for R2 or external APIs)
    // enableInternet = true;
}

const app = new Hono<{ Bindings: Env }>();

app.all("*", async (c) => {
    // Route all requests to a singleton container instance named "mcp-server"
    const container = getContainer(c.env.MY_CONTAINER, "mcp-server");
    return await container.fetch(c.req.raw);
});

export default app;
