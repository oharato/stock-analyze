import { Container, getContainer } from "@cloudflare/containers";
import { Hono } from "hono";

interface Env {
    STOCK_VIEWER_CONTAINER: DurableObjectNamespace<StockViewerContainer>;
    CLOUDFLARE_ACCOUNT_ID: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_BUCKET_NAME: string;
}

export class StockViewerContainer extends Container<Env> {
    defaultPort = 3000;
    sleepAfter = "10m";
    envVars = {
        CLOUDFLARE_ACCOUNT_ID: this.env.CLOUDFLARE_ACCOUNT_ID,
        R2_ACCESS_KEY_ID: this.env.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: this.env.R2_SECRET_ACCESS_KEY,
        R2_BUCKET_NAME: this.env.R2_BUCKET_NAME
    };
    enableInternet = true;
}

const app = new Hono<{ Bindings: Env }>();

app.all("*", async (c) => {
    // Route all requests to a singleton container instance named "main"
    const container = getContainer(c.env.STOCK_VIEWER_CONTAINER, "main");
    return await container.fetch(c.req.raw);
});

export default app;
