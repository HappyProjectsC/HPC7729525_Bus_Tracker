import { Router } from "express";
import * as auth from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";

const r = Router();

r.post("/register", authLimiter, auth.register);
r.post("/login", authLimiter, auth.login);
r.post("/refresh", authLimiter, auth.refresh);
r.post("/logout", auth.logout);
r.get("/me", requireAuth, auth.me);
r.patch("/change-password", authLimiter, requireAuth, auth.changePassword);

export default r;
