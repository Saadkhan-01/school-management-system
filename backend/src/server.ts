
import { createServer } from "http";
import app from "./app";
import { env } from "./config/env";
import { connectDb } from "./config/db";
import { logger } from "./utils/logger";
import { attachSocket } from "./modules/notifications/socket";
async function main() {
  await connectDb();
  // Phase 9: Socket.IO shares the SAME HTTP server (and port) as the REST
  // API. Attaching it does not change startup/health behaviour — the health
  // endpoint and DB gating work exactly as before, with or without MongoDB.
  const httpServer = createServer(app);
  attachSocket(httpServer);
  httpServer.listen(env.port, () => logger.info(`School ERP backend listening on port ${env.port} (env=${env.nodeEnv})`));
}
main().catch((e) => { logger.error("Fatal startup error", e); process.exit(1); });
