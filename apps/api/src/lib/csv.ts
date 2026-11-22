const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Stop Excel and Google Sheets from treating a cell as a formula. */
export function neutralizeSpreadsheetFormula(value: string): string {
  if (FORMULA_PREFIX.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function csvEscape(value: string): string {
  const safe = neutralizeSpreadsheetFormula(value);
  if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}
