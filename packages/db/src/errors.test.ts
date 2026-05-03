import { describe, expect, it } from "vitest";
import { InvalidContentError, PostNotFoundError, UserNotFoundError } from "./errors";

describe("db domain errors", () => {
  it("uses default messages when identifiers are omitted", () => {
    expect(new UserNotFoundError().message).toBe("user not found");
    expect(new PostNotFoundError().message).toBe("post not found");
    expect(new InvalidContentError().message).toBe("content must not be empty");
  });

  it("exposes stable error codes", () => {
    expect(new UserNotFoundError("ghost")).toMatchObject({ code: "user_not_found" });
    expect(new PostNotFoundError("p1")).toMatchObject({ code: "post_not_found" });
    expect(new InvalidContentError("bad")).toMatchObject({ code: "invalid_content" });
  });
});
