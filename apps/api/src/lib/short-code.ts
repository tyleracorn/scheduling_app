import { AppError } from "./errors.js";

const SHORT_CODE_RE = /^[A-Za-z0-9]{1,3}$/;

/** Normalize and validate a user-supplied short code (stored uppercase). */
export function normalizeShortCode(raw: string): string {
  const code = raw.trim().toUpperCase();
  if (!SHORT_CODE_RE.test(code)) {
    throw new AppError(
      400,
      "validation_error",
      "short_code must be 1–3 alphanumeric characters",
    );
  }
  return code;
}

/** Derive a candidate short code from a household name (not uniqueness-checked). */
export function deriveShortCodeFromName(name: string): string {
  const householdMatch = name.match(/^Household\s+(\d+)$/i);
  if (householdMatch) {
    return (`H${householdMatch[1]}`).slice(0, 3).toUpperCase();
  }
  const alnum = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (alnum.length > 0) return alnum.slice(0, 3);
  return "X";
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** Pick an unused short code, preferring `preferred` then nearby variants within 3 chars. */
export function allocateUniqueShortCode(
  preferred: string,
  taken: Set<string>,
): string {
  const base = preferred.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "X";
  if (!taken.has(base)) return base;

  const prefix = base.slice(0, 2);
  for (const ch of ALPHABET) {
    const candidate = (prefix + ch).slice(0, 3);
    if (!taken.has(candidate)) return candidate;
  }

  for (let len = 1; len <= 3; len++) {
    const indices = new Array(len).fill(0);
    while (true) {
      const candidate = indices.map((i) => ALPHABET[i]!).join("");
      if (!taken.has(candidate)) return candidate;
      let carry = 1;
      for (let p = len - 1; p >= 0 && carry; p--) {
        indices[p]! += carry;
        if (indices[p]! >= ALPHABET.length) {
          indices[p] = 0;
          carry = 1;
        } else {
          carry = 0;
        }
      }
      if (carry) break;
    }
  }

  throw new AppError(500, "short_code_exhausted", "No available short codes left");
}
