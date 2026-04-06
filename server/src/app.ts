import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import mongoSanitize from "express-mongo-sanitize";
import { env } from "./config/env.js";
import { corsOriginCallback } from "./utils/corsOrigin.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import parentRoutes from "./routes/parentRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

const app = express();

if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(
  cors({
    origin: corsOriginCallback,
    credentials: true,
  })
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(mongoSanitize());

app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", apiLimiter, adminRoutes);
app.use("/api/driver", apiLimiter, driverRoutes);
app.use("/api/student", apiLimiter, studentRoutes);
app.use("/api/parent", apiLimiter, parentRoutes);
app.use("/api/location", locationRoutes);
app.use("/api/notifications", apiLimiter, notificationRoutes);

app.use(errorHandler);

export default app;
