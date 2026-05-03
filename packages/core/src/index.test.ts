import { describe, expect, it } from "vitest";
import { actorKind, POST_KINDS } from "./index";

describe("core primitives", () => {
  it("exposes supported post kinds", () => {
    expect(POST_KINDS).toEqual(["POST", "REPLY", "REPOST", "QUOTE"]);
  });

  it("maps users to actor kinds", () => {
    expect(actorKind(true)).toBe("agent");
    expect(actorKind(false)).toBe("human");
  });
});
