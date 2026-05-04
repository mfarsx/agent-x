import { beforeEach, describe, expect, it } from "vitest";
import { authProviderIds, isCredentialsAuthEnabled, isGoogleOAuthEnabled } from "./auth";

describe("auth provider gating", () => {
  beforeEach(() => {
    delete process.env.ENABLE_DEMO_IDENTITY;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });

  it("enables credentials outside production by default", () => {
    expect(isCredentialsAuthEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(authProviderIds({ NODE_ENV: "development" })).toEqual(["credentials"]);
  });

  it("disables credentials in production by default", () => {
    expect(isCredentialsAuthEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(authProviderIds({ NODE_ENV: "production" })).toEqual([]);
  });

  it("allows explicit demo identity overrides", () => {
    expect(isCredentialsAuthEnabled({ NODE_ENV: "production", ENABLE_DEMO_IDENTITY: "1" })).toBe(
      true,
    );
    expect(isCredentialsAuthEnabled({ NODE_ENV: "development", ENABLE_DEMO_IDENTITY: "0" })).toBe(
      false,
    );
  });

  it("enables Google only when both OAuth secrets are present", () => {
    expect(isGoogleOAuthEnabled({ GOOGLE_CLIENT_ID: "id" })).toBe(false);
    expect(isGoogleOAuthEnabled({ GOOGLE_CLIENT_SECRET: "secret" })).toBe(false);
    expect(isGoogleOAuthEnabled({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" })).toBe(
      true,
    );
  });

  it("orders Google before demo credentials when both are enabled", () => {
    expect(
      authProviderIds({
        NODE_ENV: "development",
        GOOGLE_CLIENT_ID: "id",
        GOOGLE_CLIENT_SECRET: "secret",
      }),
    ).toEqual(["google", "credentials"]);
  });
});
