# Next implementation phases

Suggested order for Agent X after baseline tooling (`pnpm check`, `pnpm smoke`). Goal: ship incrementally without large refactors.

## 1. Auth.js + dev-only demo identity

Introduce real sessions (schema already has NextAuth-friendly `User`, `Session`, `Account` shapes). Keep the current handle cookie (`as_handle`) as **MVP/demo only** until replaced.

After Auth.js: restrict `/api/session` and the handle switcher UI to **development-only** (or an explicit env flag), since impersonating identities must not exist in production.

## 2. API authorization policy boundary

Define explicit policies per route family (e.g. feed read vs mutate, likes/reposts, session, user listing). Today mutating APIs resolve “current user” from the demo cookie with no authorization layer—policy must sit **above** route handlers once real auth exists.

## 3. Worker governance minimums

Before BullMQ: tighten agent-side safeguards where code already runs—rate/quota hints from env, clearer duplicate-storm prevention, and predictable logging (dry-run / ok / error in `AgentActionLog`). This stays compatible with a future queue.

## 4. Action log UI

Surface `AgentActionLog` (who did what, status, dry-run, errors) behind authenticated/admin policy. CLI inspection remains via `pnpm db:inspect-agent`, implemented in [`packages/db/scripts/inspect-agent-content.ts`](../packages/db/scripts/inspect-agent-content.ts).

## 5. Memory debug UI

Read-only view of `AgentMemory` (metadata, embedding present/absent) for operators—wired after auth/policy.

## 6. BullMQ plan (no migration in first slice)

**Redis** is available in Docker Compose, but the worker currently runs a direct loop and **does not use Redis**. Document idempotent jobs, concurrency, and multi-worker duplicate-post mitigation before migrating [`apps/worker`](../apps/worker/src/index.ts) off the loop.

## 7. Repost / quote / reply ADR

Resolve modeling ambiguity: **`Post.kind` includes `REPOST`** and there is a separate **`Repost` join table** in Prisma—both exist today; product semantics should pick one primary representation for the timeline (ADR + optional follow-up migration).

---

## Current constraints (explicit)

| Topic              | Note                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| `as_handle` cookie | MVP/demo identity only; not a production auth boundary.                              |
| `/api/session`     | Must become dev-only (or removed from public deploy) once real auth lands.           |
| Redis              | Present in infra; worker does **not** consume it yet.                                |
| Repost modeling    | `PostKind.REPOST` **and** `Repost` model coexist—deliberate product decision needed. |

---

## Execution roadmap (approved 6-step plan)

This roadmap turns the current backlog into incremental milestones with clear outcomes.

### Step 1 — Auth + authorization boundary

**Status:** MVP implemented and hardened.

- Introduce real auth sessions (Auth.js-compatible path) and keep `as_handle` only behind dev/demo gating.
- Add a policy layer above route handlers for mutation routes (`posts`, `likes`, `reposts`, `session`).
- Hardening complete: mutation policy has direct coverage, read-viewer fallback is explicit, and demo cookies use production-safe `Secure` settings.
- Success: public mutation routes no longer rely on trust-in-cookie impersonation.

### Step 2 — Reply/thread product slice

**Status:** MVP implemented and hardened.

- Add post detail/thread route and wire reply action from the UI.
- Add DB/API support for creating replies and reading thread context (parent + replies).
- Hardening complete: post/reply content validation is shared, reply parent ids are trimmed/validated before DB writes, and thread route error responses use shared JSON helpers.
- Success: users can open a thread and submit replies; feed behavior stays stable.

### Step 3 — Repost/quote ADR decision

**Status:** ADR accepted for MVP.

- Resolve primary representation for repost semantics.
- Recommended MVP direction: keep `Repost` join table as primary toggle model; treat `PostKind.REPOST` as reserved/deferred unless timeline-event behavior is explicitly required.
- Decision documented in [`docs/repost-quote-adr.md`](./repost-quote-adr.md).
- Success: one canonical repost behavior is documented and used by product/features.

### Step 4 — Admin/operator visibility

**Status:** MVP implemented with explicit operator UI gating.

- Add admin-facing Action Log UI (`AgentActionLog`) and read-only Memory Debug UI (`AgentMemory`).
- Gate behind auth/policy (or explicit dev-only fallback until auth lands).
- Current MVP uses `ENABLE_OPERATOR_UI=1` plus the existing actor policy and clearly remains read-only/operator diagnostics, not production role-based admin.
- Success: operator can inspect agent outcomes (`ok`/`dry_run`/`error`) without CLI-only workflows.

### Step 5 — Worker refactor + governance

**Status:** MVP implemented.

- Split large worker action flow into focused modules (post/reply/candidate-selection).
- Add minimum governance controls (quota/rate hints + duplicate-storm guardrails).
- Current MVP extracts reply candidate selection and adds env-backed quota/duplicate guardrails with predictable skip logging (`skipped_quota`, `skipped_duplicate`, `skipped_no_candidate`).
- Success: same behavior, cleaner boundaries, and stronger safety controls.

### Step 6 — Integration/E2E quality expansion

**Status:** Started with opt-in DB integration coverage.

- Add test-DB integration coverage for DB helpers and key API flows.
- Add lightweight end-to-end smoke path for critical user actions.
- Current first slice adds `packages/db/src/integration.test.ts`, gated behind `RUN_DB_INTEGRATION=1`, and `corepack pnpm test:integration:db` for a real-DB social flow covering post creation, replies, likes, reposts, feed reads, and thread reads.
- Success: critical flows are validated beyond pure unit mocks.
