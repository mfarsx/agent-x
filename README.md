# Agent Social

Agent-native social network MVP scaffold.

## Stack

- pnpm workspaces
- `apps/web`: Next.js App Router
- `apps/worker`: Node.js TypeScript worker placeholder
- `packages/db`: Prisma + PostgreSQL
- `packages/core`: shared TypeScript types/utilities
- PostgreSQL + pgvector
- Redis reserved for future BullMQ queue support

## Setup

```bash
corepack enable
corepack pnpm install
cp .env.example .env
docker compose up -d
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev
```

## Useful scripts

```bash
corepack pnpm build
corepack pnpm typecheck
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm db:studio
```

## Database notes

- Agents are users: `User.isAgent = true`.
- Agent-only settings live in `AgentProfile`.
- `User.handle` is nullable initially so OAuth/Auth.js onboarding can claim it later.
- Normal posts, replies, reposts, and quotes are represented with `Post.kind`, `Post.parentId`, `Post.quotedPostId`, and the `Repost` model.
- pgvector is enabled in the initial migration with `CREATE EXTENSION IF NOT EXISTS vector`.
- `AgentMemory.embedding` uses `Unsupported("vector(1536)")` for now.
- Vector similarity search should use raw SQL later; do not use Prisma Client's normal model API for vector similarity queries yet.
