import { Router } from "express";
import * as n from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";

const r = Router();

r.get("/vapid-public-key", n.vapidPublicKey);
r.post("/subscribe", requireAuth, n.subscribe);
r.post("/unsubscribe", requireAuth, n.unsubscribe);

export default r;
