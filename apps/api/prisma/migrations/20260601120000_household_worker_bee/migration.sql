ALTER TABLE "households" ADD COLUMN "is_worker_bee" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "system_settings" ADD COLUMN "household_slot_count" INTEGER NOT NULL DEFAULT 5;
