import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { AppError, errorBody } from "./lib/errors.js";
import { config } from "./lib/config.js";
import authPlugin from "./plugins/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin.js";
import calendarRoutes from "./routes/calendar.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  const app = Fastify({ logger: config.nodeEnv !== "test" });

  await app.register(cookie, { secret: config.sessionSecret });

  await app.register(cors, {
    origin: config.isProduction ? false : [config.appUrl, "http://localhost:5173"],
    credentials: true,
  });

  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(adminRoutes);
  await app.register(calendarRoutes);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(errorBody(error.code, error.message, error.details));
    }
    app.log.error(error);
    return reply.status(500).send(errorBody("internal_error", "Internal server error"));
  });

  if (config.isProduction) {
    const webRoot = path.resolve(__dirname, "../../web/dist");
    await app.register(fastifyStatic, {
      root: webRoot,
      prefix: "/",
      wildcard: false,
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/api")) {
        return reply.sendFile("index.html", webRoot);
      }
      return reply.status(404).send(errorBody("not_found", "Not found"));
    });
  }

  return app;
}
