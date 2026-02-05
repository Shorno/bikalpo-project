# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Install Node.js for pnpm compatibility
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g pnpm@10 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY packages/ ./packages/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the server
RUN pnpm run build --filter=server...

# Production stage
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Copy built files and node_modules
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder /app/packages ./packages

WORKDIR /app/apps/server

EXPOSE 3000

CMD ["bun", "run", "dist/index.mjs"]
