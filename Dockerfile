# 1. Base Image
FROM node:24-slim

# 2. Set Working Directory
WORKDIR /app

# 3. Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 4. Install pnpm
RUN npm install -g pnpm

# 5. Copy dependency manifests from monorepo root
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY tsconfig.base.json ./

# 6. Copy all package manifests and source code
COPY packages ./packages

# 7. Install all dependencies for mcp-server-container
RUN pnpm install --filter @stock-analyze/mcp-server-container


# 8. Build TypeScript for the mcp-server-container workspace
RUN pnpm --filter @stock-analyze/mcp-server-container build

# 9. Copy only the required Linux x64 duckdb.node binary into the container
COPY node_modules/.pnpm/@duckdb+node-bindings-linux-x64@1.4.2-r.1/node_modules/@duckdb/node-bindings-linux-x64/duckdb.node packages/mcp-server-container/node_modules/@duckdb/node-bindings-linux-x64/duckdb.node

# 9. Expose port
EXPOSE 8787

# 10. Set environment
ENV NODE_ENV=production
ENV PORT=8787

# 11. Set start command
WORKDIR /app/packages/mcp-server-container
CMD ["node", "dist/index.js"]
