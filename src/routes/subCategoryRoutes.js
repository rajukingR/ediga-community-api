import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";

import {
  createSubCategory,
  getSubCategories,
  getActiveSubCategories,
  getSubCategoryById,
  updateSubCategory,
  deleteSubCategory,
} from "../controllers/subCategoryController.js";

const router = express.Router();

router.post("/create", createSubCategory);

router.get("/", getSubCategories);
router.get("/active", getActiveSubCategories);
router.get("/:id", authMiddleware, getSubCategoryById);
router.put("/:id", authMiddleware, updateSubCategory);
router.delete("/:id", authMiddleware, deleteSubCategory);

export default router;