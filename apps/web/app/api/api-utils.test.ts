import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  InvalidContentError,
  PostNotFoundError,
  UserNotFoundError,
} from "@agent-social/db";
import {
  dbErrorResponse,
  jsonError,
  parseJsonBody,
  postIdBodySchema,
} from "./api-utils";

describe("jsonError", () => {
  it("returns JSON body and HTTP status", async () => {
    const res = jsonError("not_found", 404);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "not_found" });
  });
});

describe("dbErrorResponse", () => {
  it("maps InvalidContentError to 400", async () => {
    const res = dbErrorResponse(new InvalidContentError(), "fallback");
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_content" });
  });

  it("maps PostNotFoundError to 404", async () => {
    const res = dbErrorResponse(new PostNotFoundError("p1"), "fallback");
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "post_not_found" });
  });

  it("maps UserNotFoundError to 404", async () => {
    const res = dbErrorResponse(new UserNotFoundError("nobody"), "fallback");
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "user_not_found" });
  });

  it("returns fallback code for unknown errors", async () => {
    const res = dbErrorResponse(new Error("boom"), "server_error");
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "server_error" });
  });
});

describe("parseJsonBody", () => {
  it("returns parsed data when body matches schema", async () => {
    const req = new NextRequest("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ postId: "abc123" }),
      headers: { "content-type": "application/json" },
    });
    const { data, response } = await parseJsonBody(req, postIdBodySchema);
    expect(response).toBeNull();
    expect(data).toEqual({ postId: "abc123" });
  });

  it("returns invalid_body when JSON is not valid", async () => {
    const req = new NextRequest("http://localhost/api", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    });
    const { data, response } = await parseJsonBody(req, postIdBodySchema);
    expect(data).toBeNull();
    expect(response?.status).toBe(400);
    await expect(response!.json()).resolves.toEqual({ error: "invalid_body" });
  });

  it("returns invalid_body when schema validation fails", async () => {
    const req = new NextRequest("http://localhost/api", {
      method: "POST",
      body: JSON.stringify({ postId: "" }),
      headers: { "content-type": "application/json" },
    });
    const { data, response } = await parseJsonBody(req, postIdBodySchema);
    expect(data).toBeNull();
    expect(response?.status).toBe(400);
  });
});

describe("postIdBodySchema", () => {
  it("requires non-empty postId", () => {
    expect(() => postIdBodySchema.parse({ postId: "" })).toThrow();
    expect(postIdBodySchema.parse({ postId: "x" })).toEqual({ postId: "x" });
  });
});
