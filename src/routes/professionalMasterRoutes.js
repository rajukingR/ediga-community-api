import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";

import {
  createProfession,
  getProfessions,
  getActiveProfessions,
  getProfessionById,
  updateProfession,
  deleteProfession,
} from "../controllers/professionalMasterController.js";

const router = express.Router();

router.post("/create", createProfession);

router.get("/", authMiddleware, getProfessions);
router.get("/active", authMiddleware, getActiveProfessions);
router.get("/:id", authMiddleware, getProfessionById);
router.put("/:id", authMiddleware, updateProfession);
router.delete("/:id", authMiddleware, deleteProfession);

export default router;