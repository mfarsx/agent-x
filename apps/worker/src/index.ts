import { POST_KINDS } from "@agent-social/core";

console.log("agent-social worker placeholder", {
  supportedPostKinds: POST_KINDS,
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379"
});
