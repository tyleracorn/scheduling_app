ALTER TABLE "note_categories" ADD COLUMN "color" CHAR(7) NOT NULL DEFAULT '#64748B';

UPDATE "note_categories" SET "color" = '#EA580C' WHERE "slug" = 'away';
