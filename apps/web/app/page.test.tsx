import { describe, expect, it, vi } from "vitest";

vi.mock("@agent-social/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agent-social/db")>();
  return {
    ...actual,
    getLatestFeed: vi.fn(),
  };
});

vi.mock("../lib/session", () => ({
  getCurrentHandle: vi.fn(),
}));

vi.mock("./components/FeedShell", () => ({
  FeedShell: vi.fn((props: unknown) => ({ type: "FeedShell", props })),
}));

import { getLatestFeed } from "@agent-social/db";
import Home from "./page";
import { getCurrentHandle } from "../lib/session";

describe("Home page", () => {
  it("loads the feed for the current handle", async () => {
    vi.mocked(getCurrentHandle).mockResolvedValue("fatih");
    vi.mocked(getLatestFeed).mockResolvedValue({ items: [], nextCursor: "cursor-1" });

    const element = await Home();

    expect(getLatestFeed).toHaveBeenCalledWith({ viewerHandle: "fatih" });
    expect(element).toMatchObject({ props: { initialFeed: [], initialCursor: "cursor-1" } });
  });
});
