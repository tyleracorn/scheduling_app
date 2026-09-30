-- Editable household shortcodes (1–3 alphanumeric, stored uppercase, unique)
ALTER TABLE "households" ADD COLUMN "short_code" VARCHAR(3);

-- Backfill from name: "Household N" → HN; else first 1–3 alphanumeric chars, uppercased
UPDATE "households"
SET "short_code" = CASE
  WHEN name ~* '^Household\s+(\d+)$' THEN
    LEFT('H' || (regexp_match(name, '^Household\s+(\d+)$', 'i'))[1], 3)
  ELSE
    LEFT(UPPER(regexp_replace(name, '[^A-Za-z0-9]', '', 'g')), 3)
  END
WHERE "short_code" IS NULL;

-- Fallback for empty/non-alphanumeric names
UPDATE "households"
SET "short_code" = 'X'
WHERE "short_code" IS NULL OR "short_code" = '';

-- Resolve collisions: keep first by created_at/name; reassign others to unused codes
DO $$
DECLARE
  r RECORD;
  candidate TEXT;
  alphabet TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  i INT;
  j INT;
  k INT;
  base TEXT;
  used BOOLEAN;
BEGIN
  FOR r IN
    SELECT h.id, h.short_code, h.created_at, h.name
    FROM households h
    WHERE EXISTS (
      SELECT 1 FROM households h2
      WHERE h2.short_code = h.short_code AND h2.id <> h.id
    )
    AND h.id NOT IN (
      SELECT DISTINCT ON (short_code) id
      FROM households
      ORDER BY short_code, created_at ASC, name ASC
    )
    ORDER BY h.created_at ASC, h.name ASC
  LOOP
    base := LEFT(r.short_code, 2);
    candidate := NULL;
    -- Try base + suffix letter/digit within 3 chars
    FOR i IN 1..LENGTH(alphabet) LOOP
      candidate := LEFT(base || SUBSTRING(alphabet FROM i FOR 1), 3);
      SELECT EXISTS(SELECT 1 FROM households WHERE short_code = candidate) INTO used;
      EXIT WHEN NOT used;
      candidate := NULL;
    END LOOP;
    -- Exhaustive 1–3 char search if still colliding
    IF candidate IS NULL THEN
      FOR i IN 1..LENGTH(alphabet) LOOP
        candidate := SUBSTRING(alphabet FROM i FOR 1);
        SELECT EXISTS(SELECT 1 FROM households WHERE short_code = candidate) INTO used;
        EXIT WHEN NOT used;
        candidate := NULL;
      END LOOP;
    END IF;
    IF candidate IS NULL THEN
      FOR i IN 1..LENGTH(alphabet) LOOP
        FOR j IN 1..LENGTH(alphabet) LOOP
          candidate := SUBSTRING(alphabet FROM i FOR 1) || SUBSTRING(alphabet FROM j FOR 1);
          SELECT EXISTS(SELECT 1 FROM households WHERE short_code = candidate) INTO used;
          EXIT WHEN NOT used;
          candidate := NULL;
        END LOOP;
        EXIT WHEN candidate IS NOT NULL;
      END LOOP;
    END IF;
    IF candidate IS NULL THEN
      FOR i IN 1..LENGTH(alphabet) LOOP
        FOR j IN 1..LENGTH(alphabet) LOOP
          FOR k IN 1..LENGTH(alphabet) LOOP
            candidate :=
              SUBSTRING(alphabet FROM i FOR 1) ||
              SUBSTRING(alphabet FROM j FOR 1) ||
              SUBSTRING(alphabet FROM k FOR 1);
            SELECT EXISTS(SELECT 1 FROM households WHERE short_code = candidate) INTO used;
            EXIT WHEN NOT used;
            candidate := NULL;
          END LOOP;
          EXIT WHEN candidate IS NOT NULL;
        END LOOP;
        EXIT WHEN candidate IS NOT NULL;
      END LOOP;
    END IF;
    IF candidate IS NULL THEN
      RAISE EXCEPTION 'Could not allocate unique short_code for household %', r.id;
    END IF;
    UPDATE households SET short_code = candidate WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE "households" ALTER COLUMN "short_code" SET NOT NULL;
CREATE UNIQUE INDEX "households_short_code_key" ON "households"("short_code");
