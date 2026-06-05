import express from "express";
import {
  getDashboardDetails,
  getGrowthOverview,
  getStateDistribution,
  getRecentIssues,
  getRecentActivities,
} from "../controllers/dashboardDetailsController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/details", authMiddleware, getDashboardDetails);
router.get("/growth", authMiddleware, getGrowthOverview);
router.get("/states", authMiddleware, getStateDistribution);
router.get("/recent-issues", authMiddleware, getRecentIssues);
router.get("/recent-activities", authMiddleware, getRecentActivities);

export default router;