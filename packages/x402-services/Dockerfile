FROM node:20-slim AS base

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy only x402-services package
COPY packages/x402-services ./packages/x402-services

# Install dependencies for x402-services only
RUN pnpm install --frozen-lockfile --filter @synthesis-hack/x402-services...

# Build
RUN pnpm --filter @synthesis-hack/x402-services build

# --- Production stage ---
FROM node:20-slim AS production

WORKDIR /app

COPY --from=base /app/packages/x402-services/dist ./dist
COPY --from=base /app/packages/x402-services/package.json ./package.json

# Install production deps with npm (no symlink issues like pnpm)
RUN npm install --omit=dev

ENV PORT=3002

EXPOSE 3002

CMD ["node", "dist/index.mjs"]
