import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not_found");
  }),
}));

vi.mock("@agent-social/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agent-social/db")>();
  return {
    ...actual,
    getOperatorDashboard: vi.fn(),
  };
});

vi.mock("../api/policies", () => ({
  requireOperatorAccess: vi.fn(),
}));

import { getOperatorDashboard } from "@agent-social/db";
import { notFound } from "next/navigation";
import { requireOperatorAccess } from "../api/policies";
import OperatorPage from "./page";

describe("OperatorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders dashboard data for allowed operators", async () => {
    vi.mocked(requireOperatorAccess).mockResolvedValue({
      actor: { handle: "fatih", source: "auth" },
      response: null,
    });
    vi.mocked(getOperatorDashboard).mockResolvedValue({
      actionLogs: [
        {
          id: "log-1",
          action: "post",
          targetType: "post",
          targetId: "post-1",
          status: "ok",
          input: { content: "hello" },
          output: null,
          error: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          agent: { handle: "scout_ai", name: "Scout" },
        },
      ],
      memories: [
        {
          id: "memory-1",
          contentPreview: "remember this",
          metadata: { type: "ephemeral_post" },
          embeddingPresent: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          agent: { handle: "scout_ai", name: "Scout" },
        },
      ],
    });

    const element = await OperatorPage();

    expect(getOperatorDashboard).toHaveBeenCalledOnce();
    expect(JSON.stringify(element)).toContain("Agent operations");
    expect(JSON.stringify(element)).toContain("embedding");
    expect(JSON.stringify(element)).toContain("present");
  });

  it("renders an auth-required message for unauthenticated access", async () => {
    vi.mocked(requireOperatorAccess).mockResolvedValue({
      actor: null,
      response: NextResponse.json({ error: "unauthenticated" }, { status: 401 }),
    });

    const element = await OperatorPage();

    expect(JSON.stringify(element)).toContain("Authentication required");
    expect(getOperatorDashboard).not.toHaveBeenCalled();
  });

  it("returns not found when the operator UI is disabled", async () => {
    vi.mocked(requireOperatorAccess).mockResolvedValue({
      actor: null,
      response: NextResponse.json({ error: "operator_ui_disabled" }, { status: 404 }),
    });

    await expect(OperatorPage()).rejects.toThrow("not_found");
    expect(notFound).toHaveBeenCalledOnce();
  });
});
