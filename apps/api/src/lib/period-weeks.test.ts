import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computePeriodWeeks,
  computePeriodWeeksExact,
  periodBoundsFromWeeks,
  WEEK_SPAN_DAYS,
} from "./period-weeks.js";
import { toDateString } from "./dates.js";

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

  it("computePeriodWeeks stops at handoff day without an extra week", () => {
    const start = new Date(Date.UTC(2026, 0, 3));
    const exact = computePeriodWeeksExact(start, 13, 6);
    const end = exact[exact.length - 1]!.weekEndDate;
    const fromRange = computePeriodWeeks(start, end, 6);
    assert.equal(fromRange.length, 13);
    assert.equal(toDateString(fromRange[0]!.weekStartDate), "2026-01-03");
    assert.equal(toDateString(fromRange[fromRange.length - 1]!.weekEndDate), toDateString(end));
  });

  it("periodBoundsFromWeeks returns first start through last handoff", () => {
    const start = new Date(Date.UTC(2026, 0, 3));
    const weeks = computePeriodWeeksExact(start, 3, 6);
    const bounds = periodBoundsFromWeeks(weeks);
    assert.ok(bounds);
    assert.equal(toDateString(bounds.startDate), "2026-01-03");
    assert.equal(toDateString(bounds.endDate), "2026-01-24");
  });
});
