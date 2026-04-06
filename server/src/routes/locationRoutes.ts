import { Router } from "express";
import * as loc from "../controllers/locationController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { locationLimiter } from "../middleware/rateLimit.js";

const r = Router();
r.post("/", locationLimiter, requireAuth, requireRole("driver"), loc.postLocation);

export default r;
