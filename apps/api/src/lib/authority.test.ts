import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canUseSchedulingTools,
  hasCoordinatorHouseholdTier,
  isSystemAdmin,
  type UserAuthContext,
} from "./authority.js";

function user(partial: Partial<UserAuthContext> & Pick<UserAuthContext, "isAdmin">): UserAuthContext {
  return {
    schedulingToolsEnabled: partial.schedulingToolsEnabled ?? true,
    household: partial.household ?? null,
    isAdmin: partial.isAdmin,
  };
}

describe("authority", () => {
  it("isSystemAdmin when user.isAdmin", () => {
    assert.equal(isSystemAdmin(user({ isAdmin: true, household: null })), true);
  });

  it("isSystemAdmin when household authority is admin", () => {
    assert.equal(
      isSystemAdmin(
        user({
          isAdmin: false,
          household: { authority: "admin", isWorkerBee: false },
        }),
      ),
      true,
    );
  });

  it("is not system admin for active or coordinator household alone", () => {
    assert.equal(
      isSystemAdmin(
        user({
          isAdmin: false,
          household: { authority: "active", isWorkerBee: false },
        }),
      ),
      false,
    );
    assert.equal(
      isSystemAdmin(
        user({
          isAdmin: false,
          household: { authority: "coordinator", isWorkerBee: false },
        }),
      ),
      false,
    );
  });

  it("canUseSchedulingTools for system admin even without household", () => {
    assert.equal(canUseSchedulingTools(user({ isAdmin: true, household: null })), true);
  });

  it("canUseSchedulingTools for coordinator household with tools enabled", () => {
    assert.equal(
      canUseSchedulingTools(
        user({
          isAdmin: false,
          schedulingToolsEnabled: true,
          household: { authority: "coordinator", isWorkerBee: false },
        }),
      ),
      true,
    );
  });

  it("blocks scheduling tools when coordinator has tools disabled", () => {
    assert.equal(
      canUseSchedulingTools(
        user({
          isAdmin: false,
          schedulingToolsEnabled: false,
          household: { authority: "coordinator", isWorkerBee: false },
        }),
      ),
      false,
    );
  });

  it("blocks scheduling tools for active household members", () => {
    assert.equal(
      canUseSchedulingTools(
        user({
          isAdmin: false,
          schedulingToolsEnabled: true,
          household: { authority: "active", isWorkerBee: false },
        }),
      ),
      false,
    );
  });

  it("blocks scheduling tools for Worker Bee even if authority is coordinator", () => {
    assert.equal(
      canUseSchedulingTools(
        user({
          isAdmin: false,
          schedulingToolsEnabled: true,
          household: { authority: "coordinator", isWorkerBee: true },
        }),
      ),
      false,
    );
  });

  it("blocks scheduling tools when user has no household", () => {
    assert.equal(
      canUseSchedulingTools(
        user({ isAdmin: false, schedulingToolsEnabled: true, household: null }),
      ),
      false,
    );
  });

  it("hasCoordinatorHouseholdTier only for non-Worker Bee coordinator households", () => {
    assert.equal(
      hasCoordinatorHouseholdTier(
        user({
          isAdmin: false,
          household: { authority: "coordinator", isWorkerBee: false },
        }),
      ),
      true,
    );
    assert.equal(
      hasCoordinatorHouseholdTier(
        user({
          isAdmin: false,
          household: { authority: "coordinator", isWorkerBee: true },
        }),
      ),
      false,
    );
    assert.equal(
      hasCoordinatorHouseholdTier(
        user({
          isAdmin: false,
          household: { authority: "active", isWorkerBee: false },
        }),
      ),
      false,
    );
  });
});
