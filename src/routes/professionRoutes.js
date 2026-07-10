import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";

import {
  createProfession,
  getProfessions,
  getActiveProfessions,
  getProfessionById,
  updateProfession,
  deleteProfession,
} from "../controllers/professionController.js";

const router = express.Router();

router.post("/create", createProfession);

router.get("/", getProfessions);
router.get("/active", getActiveProfessions);
router.get("/:id", authMiddleware, getProfessionById);
router.put("/:id", authMiddleware, updateProfession);
router.delete("/:id", authMiddleware, deleteProfession);

export default router;