import { config } from "./lib/config.js";
import { buildApp } from "./app.js";
import { startScheduler } from "./jobs/scheduler.js";

const app = await buildApp();

if (config.nodeEnv !== "test") {
  startScheduler();
}

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.info(`API listening on http://0.0.0.0:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
