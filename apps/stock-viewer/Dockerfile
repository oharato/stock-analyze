# 1. Base Image
FROM node:24-slim AS builder

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

# 5. Copy manifests and source
COPY package.json pnpm-lock.yaml* ./
COPY tsconfig.json ./
# Copy source code including client and other necessary files
COPY src ./src
COPY client ./client
# 6. Install dependencies and Build
# Install ALL dependencies (including devDependencies) to run the build
RUN echo "supportedArchitectures.os=linux" > .npmrc && \
    echo "supportedArchitectures.cpu=x64,arm64" >> .npmrc && \
    pnpm install --frozen-lockfile

# Run build
RUN pnpm run build

# --- Runner Stage ---
FROM node:24-slim AS runner

WORKDIR /app

# Install pnpm (needed if we want to use pnpm to run, or we can just use node)
RUN npm install -g pnpm

# Copy package.json to run scripts if needed, or just for metadata
COPY package.json pnpm-lock.yaml* ./

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
# Install only production dependencies
# We need to copy .npmrc or recreate it to ensure sharp installs correctly
COPY --from=builder /app/.npmrc ./
RUN pnpm install --prod --frozen-lockfile

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Start command
CMD ["node", "dist/index.js"]
