import { describe, it } from "node:test";
import assert from "node:assert/strict";

const MS_PER_HOUR = 60 * 60 * 1000;

/** Mirrors warning threshold logic in processTurnWarnings. */
function shouldSendWarning(
  now: Date,
  expiresAt: Date,
  pickWarningLeadHours: number,
  warningSentAt: Date | null,
): boolean {
  if (warningSentAt !== null) return false;
  const leadMs = pickWarningLeadHours * MS_PER_HOUR;
  if (leadMs <= 0) return false;
  const warningAt = new Date(expiresAt.getTime() - leadMs);
  return now >= warningAt;
}

describe("turn warnings", () => {
  it("fires when now is within the warning window before expiry", () => {
    const expiresAt = new Date("2026-06-10T18:00:00Z");
    const now = new Date("2026-06-10T12:00:00Z");
    assert.equal(shouldSendWarning(now, expiresAt, 12, null), true);
  });

  it("does not fire before the warning window", () => {
    const expiresAt = new Date("2026-06-10T18:00:00Z");
    const now = new Date("2026-06-10T05:00:00Z");
    assert.equal(shouldSendWarning(now, expiresAt, 12, null), false);
  });

  it("does not fire twice after warning_sent_at is set", () => {
    const expiresAt = new Date("2026-06-10T18:00:00Z");
    const now = new Date("2026-06-10T17:00:00Z");
    assert.equal(shouldSendWarning(now, expiresAt, 12, new Date("2026-06-10T12:00:00Z")), false);
  });

  it("does not fire when lead hours is zero", () => {
    const expiresAt = new Date("2026-06-10T18:00:00Z");
    const now = new Date("2026-06-10T17:59:00Z");
    assert.equal(shouldSendWarning(now, expiresAt, 0, null), false);
  });
});
