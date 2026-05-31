import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

const isProduction = process.env.NODE_ENV === "production";

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://cabin:cabin@localhost:5432/cabin_scheduling",
  sessionSecret: isProduction
    ? required("SESSION_SECRET")
    : (process.env.SESSION_SECRET ?? "dev-session-secret-change-in-production-min-32"),
  sessionCookieName: "cabin_session",
  sessionDays: 14,
  appUrl: process.env.APP_URL ?? "http://localhost:5173",
  apiUrl: process.env.API_URL ?? "http://localhost:3000",
  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? "changeme",
  smtp: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? "noreply@example.com",
  },
  isProduction,
};
