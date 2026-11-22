import bcrypt from "bcrypt";

const ROUNDS = 12;

/**
 * Cost matches real password hashes so a missing account takes the same time
 * as a wrong password. This hash does not belong to any user.
 */
const DUMMY_PASSWORD_HASH = "$2b$12$ZfHbA235tuC/4scJzhTURe8B6nkDjNruUCNRRHwJGT2RiRSBw.j8S";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Compare against the stored hash, or a dummy hash when the account is missing. */
export async function passwordMatches(password: string, hash: string | null): Promise<boolean> {
  const ok = await verifyPassword(password, hash ?? DUMMY_PASSWORD_HASH);
  if (!hash) return false;
  return ok;
}
