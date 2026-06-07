-- Add coordinator flag to households
ALTER TABLE "households" ADD COLUMN "is_coordinator" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from users who were coordinators
UPDATE "households" h
SET "is_coordinator" = true
WHERE EXISTS (
  SELECT 1
  FROM "household_memberships" hm
  JOIN "users" u ON u."id" = hm."user_id"
  WHERE hm."household_id" = h."id"
    AND u."is_coordinator" = true
    AND u."active" = true
);

-- Worker Bee cannot be a coordinator household
UPDATE "households" SET "is_coordinator" = false WHERE "is_worker_bee" = true;

ALTER TABLE "users" DROP COLUMN "is_coordinator";
