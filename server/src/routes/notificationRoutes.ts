import { Router } from "express";
import * as n from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";

const r = Router();

r.get("/vapid-public-key", n.vapidPublicKey);
r.post("/subscribe", requireAuth, n.subscribe);
r.post("/unsubscribe", requireAuth, n.unsubscribe);
r.get("/in-app", requireAuth, n.listNotifications);
r.patch("/in-app/:id/read", requireAuth, n.markRead);
r.post("/in-app/read-all", requireAuth, n.markAllRead);

export default r;
