import { Router } from "express";
import * as parent from "../controllers/parentController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const r = Router();
r.use(requireAuth, requireRole("parent"));

r.get("/my-bus", parent.myBus);

export default r;
