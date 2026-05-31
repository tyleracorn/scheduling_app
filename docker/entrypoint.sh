#!/bin/sh
set -e
cd /app/apps/api
npx prisma migrate deploy
npx prisma db seed
cd /app
exec node apps/api/dist/index.js
