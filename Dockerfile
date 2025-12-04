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

# 5. Copy dependency manifests
COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY worker-configuration.d.ts ./

# 6. Install dependencies
RUN pnpm install

# 7. Copy source code
COPY container_src ./src

# 8. Build TypeScript
RUN pnpm build

# 9. Expose port
EXPOSE 8787

# 10. Set environment
ENV NODE_ENV=production
ENV PORT=8787

# 11. Set start command
CMD ["node", "dist/index.js"]
