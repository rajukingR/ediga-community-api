import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";

import {
  createSpecialization,
  getSpecializations,
  getActiveSpecializations,
  getSpecializationById,
  updateSpecialization,
  deleteSpecialization,
} from "../controllers/specializationController.js";

const router = express.Router();

router.post("/create", createSpecialization);

router.get("/", getSpecializations);
router.get("/active", getActiveSpecializations);
router.get("/:id", authMiddleware, getSpecializationById);
router.put("/:id", authMiddleware, updateSpecialization);
router.delete("/:id", authMiddleware, deleteSpecialization);

export default router;