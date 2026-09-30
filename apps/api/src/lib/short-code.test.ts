import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allocateUniqueShortCode,
  deriveShortCodeFromName,
  normalizeShortCode,
} from "./short-code.js";
import { AppError } from "./errors.js";

describe("short-code", () => {
  it("derives Hn from Household N", () => {
    assert.equal(deriveShortCodeFromName("Household 1"), "H1");
    assert.equal(deriveShortCodeFromName("Household 12"), "H12");
  });

  it("derives first alphanumeric chars otherwise", () => {
    assert.equal(deriveShortCodeFromName("Worker Bee"), "WOR");
    assert.equal(deriveShortCodeFromName("A"), "A");
  });

  it("normalizes to uppercase", () => {
    assert.equal(normalizeShortCode("ab"), "AB");
    assert.equal(normalizeShortCode("h1"), "H1");
  });

  it("rejects invalid short codes", () => {
    assert.throws(() => normalizeShortCode(""), (e) => e instanceof AppError);
    assert.throws(() => normalizeShortCode("ab!"), (e) => e instanceof AppError);
    assert.throws(() => normalizeShortCode("abcd"), (e) => e instanceof AppError);
  });

  it("allocates unique variants when preferred is taken", () => {
    const taken = new Set(["H1"]);
    assert.equal(allocateUniqueShortCode("H1", taken), "H1A");
    taken.add("H1A");
    assert.equal(allocateUniqueShortCode("H1", taken), "H1B");
  });
});
