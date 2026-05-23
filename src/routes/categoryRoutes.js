import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";

import {
  createCategory,
  getCategories,
  getActiveCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";

const router = express.Router();

router.post("/create", createCategory);

router.get("/", authMiddleware, getCategories);
router.get("/active", getActiveCategories);
router.get("/:id", authMiddleware, getCategoryById);
router.put("/:id", authMiddleware, updateCategory);
router.delete("/:id", authMiddleware, deleteCategory);

export default router;