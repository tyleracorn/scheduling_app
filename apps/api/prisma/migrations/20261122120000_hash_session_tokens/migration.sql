-- Session cookies used to be the row id. Those ids cannot be turned into
-- hashes of a secret the browser still holds, so existing logins end here.
DELETE FROM "sessions";

ALTER TABLE "sessions" ADD COLUMN "token_hash" VARCHAR(64) NOT NULL;

CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");
