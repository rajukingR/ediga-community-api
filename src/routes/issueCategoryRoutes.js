import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";

import {
  createIssueCategory,
  getIssueCategories,
  getActiveIssueCategories,
  getIssueCategoryById,
  updateIssueCategory,
  deleteIssueCategory,
} from "../controllers/issueCategoryController.js";

const router = express.Router();

router.post("/create", createIssueCategory);

router.get("/", authMiddleware, getIssueCategories);
router.get("/active", getActiveIssueCategories);
router.get("/:id", authMiddleware, getIssueCategoryById);
router.put("/:id", authMiddleware, updateIssueCategory);
router.delete("/:id", authMiddleware, deleteIssueCategory);

export default router;