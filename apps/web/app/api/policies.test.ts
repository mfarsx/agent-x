import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/session", () => ({
  getCurrentActor: vi.fn(),
}));

import { getCurrentActor } from "../../lib/session";
import { isOperatorUiEnabled, requireMutationActor, requireOperatorAccess } from "./policies";

const originalEnv = { ...process.env };

describe("requireMutationActor", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("allows authenticated actors", async () => {
    vi.mocked(getCurrentActor).mockResolvedValue({ handle: "fatih", source: "auth" });

    await expect(requireMutationActor()).resolves.toEqual({
      actor: { handle: "fatih", source: "auth" },
      response: null,
    });
  });

  it("allows demo actors when session policy resolves one", async () => {
    vi.mocked(getCurrentActor).mockResolvedValue({ handle: "scout_ai", source: "demo" });

    const result = await requireMutationActor();

    expect(result.actor).toEqual({ handle: "scout_ai", source: "demo" });
    expect(result.response).toBeNull();
  });

  it("rejects missing actors", async () => {
    vi.mocked(getCurrentActor).mockResolvedValue(null);

    const result = await requireMutationActor();

    expect(result.actor).toBeNull();
    expect(result.response?.status).toBe(401);
    await expect(result.response?.json()).resolves.toEqual({ error: "unauthenticated" });
  });
});

describe("requireOperatorAccess", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  it("returns 404 when the operator UI is disabled", async () => {
    delete process.env.ENABLE_OPERATOR_UI;

    const result = await requireOperatorAccess();

    expect(isOperatorUiEnabled()).toBe(false);
    expect(result.actor).toBeNull();
    expect(result.response?.status).toBe(404);
    await expect(result.response?.json()).resolves.toEqual({ error: "operator_ui_disabled" });
    expect(getCurrentActor).not.toHaveBeenCalled();
  });

  it("requires an actor when enabled", async () => {
    process.env.ENABLE_OPERATOR_UI = "1";
    vi.mocked(getCurrentActor).mockResolvedValue(null);

    const result = await requireOperatorAccess();

    expect(result.actor).toBeNull();
    expect(result.response?.status).toBe(401);
    await expect(result.response?.json()).resolves.toEqual({ error: "unauthenticated" });
  });

  it("allows authenticated actors when enabled", async () => {
    process.env.ENABLE_OPERATOR_UI = "1";
    vi.mocked(getCurrentActor).mockResolvedValue({ handle: "fatih", source: "auth" });

    await expect(requireOperatorAccess()).resolves.toEqual({
      actor: { handle: "fatih", source: "auth" },
      response: null,
    });
  });
});
