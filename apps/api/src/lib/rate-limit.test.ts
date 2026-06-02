import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, rateLimitKey } from "./rate-limit.js";

describe("rate-limit", () => {
  it("allows requests under the limit", () => {
    const key = rateLimitKey("127.0.0.1", "test-allow");
    assert.equal(checkRateLimit(key, 3, 60_000).allowed, true);
    assert.equal(checkRateLimit(key, 3, 60_000).allowed, true);
    assert.equal(checkRateLimit(key, 3, 60_000).allowed, true);
  });

  it("blocks requests over the limit", () => {
    const key = rateLimitKey("127.0.0.1", "test-block");
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    const third = checkRateLimit(key, 2, 60_000);
    assert.equal(third.allowed, false);
    assert.ok(third.retryAfterMs > 0);
  });
});
