import { Router } from "express";
import * as student from "../controllers/studentController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const r = Router();
r.use(requireAuth, requireRole("student"));

r.get("/my-bus", student.myBus);
r.patch("/boarding-stop", student.setBoardingStop);
r.post("/parent", student.addParent);
r.post("/feedback", student.submitFeedback);

export default r;
