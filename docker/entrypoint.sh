#!/bin/sh
set -e
cd /app/apps/api
npx prisma migrate deploy
# Bootstrap seed only (admin/households/settings). Demo data requires SEED_DEMO=true.
npx prisma db seed
cd /app
exec node apps/api/dist/index.js
