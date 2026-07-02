import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeNewHouseholds,
  periodQualifiesAsPredecessor,
  prioritiesFromOrder,
  rotateHouseholdOrder,
} from "./priority-rotation.js";

describe("priority-rotation", () => {
  it("treats shared handoff day as a valid predecessor", () => {
    const handoff = new Date(Date.UTC(2026, 8, 4));
    assert.equal(periodQualifiesAsPredecessor(handoff, handoff), true);
  });

  it("rejects periods ending after the next start", () => {
    const end = new Date(Date.UTC(2026, 8, 10));
    const start = new Date(Date.UTC(2026, 8, 4));
    assert.equal(periodQualifiesAsPredecessor(end, start), false);
  });

  it("rotates last household to first", () => {
    const ids = ["a", "b", "c", "d"];
    assert.deepEqual(rotateHouseholdOrder(ids, "d"), ["d", "a", "b", "c"]);
  });

  it("returns unchanged order when lastPicker is unknown", () => {
    const ids = ["a", "b", "c"];
    assert.deepEqual(rotateHouseholdOrder(ids, "z"), ["a", "b", "c"]);
  });

  it("merges new households at the end", () => {
    const rotated = ["d", "a", "b"];
    const all = ["a", "b", "c", "d", "e"];
    assert.deepEqual(mergeNewHouseholds(rotated, all), ["d", "a", "b", "c", "e"]);
  });

  it("builds position rows from order", () => {
    assert.deepEqual(prioritiesFromOrder(["x", "y"]), [
      { household_id: "x", position: 1 },
      { household_id: "y", position: 2 },
    ]);
  });
});
