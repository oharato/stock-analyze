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

# 5. Copy manifests
COPY package.json pnpm-lock.yaml* ./
COPY tsconfig.json ./

# 6. Install dependencies
# Set pnpm to allow building native dependencies (like sharp)
RUN echo "supportedArchitectures.os=linux" >> .npmrc && \
    echo "supportedArchitectures.cpu=x64,arm64" >> .npmrc && \
    pnpm install --prod

# 7. Copy compiled server and client code
# Note: assumes 'npm run build' was run locally before 'wrangler deploy'
# or we can build inside, but for speed we copy dist
COPY dist ./dist

# 8. Expose port (Durable Object Containers use 8080 by default internally often, 
# but let's match hono default or what we set)
EXPOSE 3000

# 9. Set environment
ENV NODE_ENV=production
ENV PORT=3000

# 10. Start command
CMD ["node", "dist/index.js"]
