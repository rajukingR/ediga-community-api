import express from "express";
import {
  createIssue,
  getAllIssues,
  getAllIssuesByUserId,
  getIssuesAssignedToUser,
  getAllIssuesById,
  getIssueById,
  updateIssue,
  updateIssueStatus,
  deleteIssue,
  assignMultipleMembers, // Add this import
  updateIssueMemberStatus
} from "../controllers/issueController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/create", createIssue);
router.get("/", authMiddleware, getAllIssues);
router.get("/user/:id", authMiddleware, getAllIssuesByUserId);
router.get("/assigned-to/:userId", authMiddleware, getIssuesAssignedToUser);

router.get("/assigned-by/:id", authMiddleware, getAllIssuesById);
router.get("/:id", authMiddleware, getIssueById);
router.put("/:id", authMiddleware, updateIssue);
router.patch("/:id/status", authMiddleware, updateIssueMemberStatus);
router.delete("/:id", authMiddleware, deleteIssue);

// Add this new route for assigning multiple professionals
router.post("/assign-multiple", authMiddleware, assignMultipleMembers);

export default router;