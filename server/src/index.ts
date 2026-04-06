import http from "http";
import mongoose from "mongoose";
import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { attachSocket } from "./sockets/index.js";
import { configureWebPush } from "./services/pushService.js";

configureWebPush();

const server = http.createServer(app);
attachSocket(server);

async function main(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  logger.info("MongoDB connected");

  server.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });
}

main().catch((e) => {
  logger.error("Fatal", e);
  process.exit(1);
});
