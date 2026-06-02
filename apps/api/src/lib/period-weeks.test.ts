import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computePeriodWeeksExact, WEEK_SPAN_DAYS } from "./period-weeks.js";

describe("period-weeks", () => {
  it("creates exact week count with shared handoff day", () => {
    const start = new Date(Date.UTC(2026, 5, 1));
    const weeks = computePeriodWeeksExact(start, 3, 5);
    assert.equal(weeks.length, 3);
    assert.equal(weeks[0]!.sortOrder, 0);
    assert.equal(weeks[1]!.weekStartDate.getTime() - weeks[0]!.weekStartDate.getTime(), 7 * 86400000);
    const spanMs = weeks[0]!.weekEndDate.getTime() - weeks[0]!.weekStartDate.getTime();
    assert.equal(spanMs, WEEK_SPAN_DAYS * 86400000);
  });
});
