// src/routes/notificationRoutes.js

import express from "express";

import {
  getNotifications,
  markNotificationAsRead,
  deleteNotification
} from "../controllers/notificationController.js";

import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

// =========================
// GET ALL NOTIFICATIONS
// =========================
router.get(
  "/",
  authMiddleware,
  getNotifications
);

// =========================
// MARK AS READ
// =========================
router.put(
  "/read/:id",
  authMiddleware,
  markNotificationAsRead
);

// =========================
// DELETE NOTIFICATION
// =========================
router.delete(
  "/delete/:id",
  authMiddleware,
  deleteNotification
);

export default router;