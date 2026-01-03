import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index';

// Mock the MCP client to avoid loading problematic dependencies (ajv/SDK) in test environment
vi.mock('../src/lib/mcp', () => ({
	createMcpClient: vi.fn(),
}));

describe('Stock Analyze AI Worker', () => {
	it('responds with 404 for root (unit style)', async () => {
		const request = new Request('http://example.com');
		// Create an empty context to pass to `worker.fetch()`.
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		// Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(404);
	});

	it('responds with 404 for root (integration style)', async () => {
		const response = await SELF.fetch('https://example.com');
		expect(response.status).toBe(404);
	});
});
