import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
				miniflare: {
					serviceBindings: {
						MCP_SERVER: async (request: Request) => {
							return new Response('Mock MCP Server Response');
						},
					},
				},
			},
		},
	},
});
