import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { csvEscape, neutralizeSpreadsheetFormula } from "./csv.js";

describe("csv formula neutralization", () => {
  it("prefixes cells that spreadsheets would treat as formulas", () => {
    assert.equal(neutralizeSpreadsheetFormula("=cmd|'/c calc'!A1"), "'=cmd|'/c calc'!A1");
    assert.equal(neutralizeSpreadsheetFormula("+1+1"), "'+1+1");
    assert.equal(neutralizeSpreadsheetFormula("-1"), "'-1");
    assert.equal(neutralizeSpreadsheetFormula("@SUM(A1)"), "'@SUM(A1)");
  });

  it("leaves ordinary note text unchanged", () => {
    assert.equal(neutralizeSpreadsheetFormula("Arriving Friday"), "Arriving Friday");
  });

  it("still quotes commas after neutralizing a formula", () => {
    assert.equal(csvEscape("=1,2"), "\"'=1,2\"");
  });
});
