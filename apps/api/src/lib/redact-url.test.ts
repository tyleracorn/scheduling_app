import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { redactTokenQuery } from "./redact-url.js";

describe("redactTokenQuery", () => {
  it("redacts a token query parameter", () => {
    assert.equal(
      redactTokenQuery("/reset-password?token=abc123"),
      "/reset-password?token=redacted",
    );
  });

  it("redacts token when other query parameters are present", () => {
    assert.equal(
      redactTokenQuery("/api/v1/auth/invite?token=secret&next=1"),
      "/api/v1/auth/invite?token=redacted&next=1",
    );
  });

  it("leaves urls without a token parameter unchanged", () => {
    assert.equal(redactTokenQuery("/api/v1/notes?start=2026-01-01"), "/api/v1/notes?start=2026-01-01");
  });
});
