# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @agent-social/db db:generate \
    && pnpm --filter @agent-social/core build \
    && pnpm --filter @agent-social/db build

FROM build AS runner
ENV NODE_ENV=production
WORKDIR /repo/apps/worker
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
