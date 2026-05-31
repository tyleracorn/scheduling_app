ALTER TABLE "system_settings"
  ADD COLUMN "period_first_week_start" DATE,
  ADD COLUMN "period_week_count" INTEGER NOT NULL DEFAULT 13,
  ADD COLUMN "open_lead_days" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "periods_to_schedule" INTEGER NOT NULL DEFAULT 4;
