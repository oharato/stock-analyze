/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { ServiceBindingTransport } from "./ServiceBindingTransport";

export interface Env {
	// If you set another name in the Wrangler config file as the value for 'binding',
	// replace "AI" with the variable name you defined.
	AI: Ai;
	MCP_SERVER: Fetcher;
	MCP_PORT?: string;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const transport = new ServiceBindingTransport(env.MCP_SERVER, "/sse", "", env.MCP_PORT);
		const client = new Client({ name: "worker-client", version: "1.0.0" }, { capabilities: {} });

		try {
			await client.connect(transport);

			// Example: List tools available on the MCP server
			const tools = await client.listTools();

			return new Response(JSON.stringify(tools, null, 2), {
				headers: { "Content-Type": "application/json" }
			});
		} catch (error) {
			return new Response(JSON.stringify({ error: String(error) }), {
				status: 500,
				headers: { "Content-Type": "application/json" }
			});
		}
	},
} satisfies ExportedHandler<Env>;
