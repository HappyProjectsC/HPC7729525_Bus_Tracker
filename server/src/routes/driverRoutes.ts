import { Router } from "express";
import * as driver from "../controllers/driverController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const r = Router();
r.use(requireAuth, requireRole("driver"));

r.get("/me/bus", driver.myBus);
r.post("/tracking/start", driver.startTracking);
r.post("/tracking/stop", driver.stopTracking);
r.post("/fault", driver.submitFault);

export default r;
