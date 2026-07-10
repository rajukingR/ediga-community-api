import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";

import {
  createMemberType,
  getMemberTypes,
  getActiveMemberTypes,
  getMemberTypeById,
  updateMemberType,
  deleteMemberType,
} from "../controllers/memberTypeController.js";

const router = express.Router();

router.post("/create", createMemberType);

router.get("/", authMiddleware, getMemberTypes);
router.get("/active", getActiveMemberTypes);
router.get("/:id", authMiddleware, getMemberTypeById);
router.put("/:id", authMiddleware, updateMemberType);
router.delete("/:id", authMiddleware, deleteMemberType);

export default router;