# ADR: repost and quote modeling

## Status

Accepted for the MVP roadmap.

## Context

The Prisma schema currently supports two possible repost representations:

- `PostKind.REPOST` as a first-class `Post` row kind.
- `Repost` as a join table between `User` and `Post`.

The current product and API implementation use `Repost` as a toggle model through
`toggleRepost()`. That keeps reposting close to likes: a viewer can add or remove
their repost state for an existing post, and feed items expose aggregate repost
counts plus viewer state.

The schema also includes `PostKind.QUOTE` and `quotedPostId`, but quote composer
behavior is not implemented yet.

## Decision

Use the `Repost` join table as the canonical MVP repost representation.

- Repost is a toggle on an existing post.
- `PostKind.REPOST` remains reserved/deferred and should not be used by new MVP
  features unless the product explicitly needs reposts as authored timeline
  events.
- Quote posts should use `PostKind.QUOTE` with `quotedPostId` when quote composer
  behavior is implemented.

## Consequences

- No schema migration is required for the MVP decision.
- Existing `/api/reposts` behavior remains the source of truth for reposts.
- Timeline rendering can continue to show repost counts and viewer repost state
  without creating duplicate post rows.
- A future timeline-event repost design can still adopt `PostKind.REPOST`, but it
  should include a migration/product note explaining how it coexists with or
  replaces the `Repost` toggle model.

## Follow-ups

- Keep product code using `toggleRepost()` for repost interactions.
- Implement quote composition separately when quote UX is prioritized.
- Revisit this ADR before adding algorithmic timeline expansion based on repost
  events.
