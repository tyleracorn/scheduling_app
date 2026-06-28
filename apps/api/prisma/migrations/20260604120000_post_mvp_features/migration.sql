-- Household authority replaces is_coordinator
CREATE TYPE "HouseholdAuthority" AS ENUM ('active', 'coordinator', 'admin');

ALTER TABLE "households" ADD COLUMN "authority" "HouseholdAuthority" NOT NULL DEFAULT 'active';

UPDATE "households" SET "authority" = 'coordinator' WHERE "is_coordinator" = true;

ALTER TABLE "households" DROP COLUMN "is_coordinator";

-- Coordinator UI toggle (coordinator-tier households only)
ALTER TABLE "users" ADD COLUMN "scheduling_tools_enabled" BOOLEAN NOT NULL DEFAULT true;

-- Period plan / coordinator cap
ALTER TABLE "system_settings" ADD COLUMN "draft_start_lead_days" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "system_settings" ADD COLUMN "max_coordinator_households" INTEGER NOT NULL DEFAULT 3;

-- Auto-draft scheduling
ALTER TABLE "scheduling_periods" ADD COLUMN "draft_start_at" TIMESTAMP(3);
ALTER TABLE "scheduling_periods" ADD COLUMN "auto_draft_paused" BOOLEAN NOT NULL DEFAULT false;

-- Note categories
CREATE TABLE "note_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "note_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "note_categories_slug_key" ON "note_categories"("slug");

ALTER TABLE "calendar_notes" ADD COLUMN "category_id" UUID;

ALTER TABLE "calendar_notes" ADD CONSTRAINT "calendar_notes_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "note_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "note_categories" ("id", "name", "slug", "active", "sort_order", "updated_at")
VALUES (gen_random_uuid(), 'Away', 'away', true, 1, CURRENT_TIMESTAMP);
