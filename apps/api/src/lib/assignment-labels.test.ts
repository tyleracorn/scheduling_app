import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatHowAssigned } from "./assignment-labels.js";

describe("formatHowAssigned", () => {
  it("maps assignment sources to user-facing labels", () => {
    assert.equal(formatHowAssigned("draft_pick"), "Draft pick");
    assert.equal(formatHowAssigned("household_swap"), "Swap");
    assert.equal(formatHowAssigned("coordinator_manual"), "Coordinator assigned");
    assert.equal(formatHowAssigned("coordinator_edit"), "Coordinator updated");
  });

  it("returns empty string when unassigned", () => {
    assert.equal(formatHowAssigned(null), "");
    assert.equal(formatHowAssigned(undefined), "");
  });
});
