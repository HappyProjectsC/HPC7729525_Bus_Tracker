import { Router } from "express";
import * as bus from "../controllers/busController.js";
import * as route from "../controllers/routeController.js";
import * as stop from "../controllers/stopController.js";
import * as user from "../controllers/userController.js";
import * as feedbackAdmin from "../controllers/feedbackAdminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const r = Router();
r.use(requireAuth, requireRole("admin"));

r.get("/buses", bus.listBuses);
r.get("/buses/:id", bus.getBus);
r.post("/buses", bus.createBus);
r.patch("/buses/:id", bus.updateBus);
r.delete("/buses/:id", bus.deleteBus);
r.patch("/buses/:id/assign-driver", bus.assignDriver);
r.patch("/buses/:id/route", bus.assignRouteToBus);

r.get("/routes", route.listRoutes);
r.get("/routes/:id", route.getRoute);
r.post("/routes", route.createRoute);
r.patch("/routes/:id", route.updateRoute);
r.delete("/routes/:id", route.deleteRoute);

r.get("/stops", stop.listStops);
r.post("/stops", stop.createStop);
r.patch("/stops/:id", stop.updateStop);
r.delete("/stops/:id", stop.deleteStop);

r.get("/users", user.listUsers);
r.post("/users", user.createUser);
r.patch("/users/:id", user.updateUser);
r.patch("/users/:id/active", user.updateUserActive);
r.delete("/users/:id", user.deleteUser);
r.patch("/students/:id/assign-bus", user.assignStudentBus);

r.get("/buses/:id/feedback", feedbackAdmin.listFeedbackForBus);
r.patch("/feedback/:id", feedbackAdmin.patchFeedback);

export default r;
