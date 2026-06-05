// routes/workRoutes.js

import express from "express";
import {
    bulkCreateWork,
    getAllWork,
    getWorkById,
    getWorkByWorkId,
    updateWorkStatus,
    addProgressNote,
    updateWork,
    deleteWork,
    getWorkStatistics,
    getAssignableUsers,
    bulkDeleteWork,
    getMyWork
} from "../controllers/workController.js";

import authMiddleware from "../middlewares/authMiddleware.js";
import upload, { convertToWebp } from "../middlewares/multer.js";

const router = express.Router();

router.use(authMiddleware);


router.post(
    "/create-bulk",
    upload.array("attachments", 5),
    bulkCreateWork
);

router.get("/assignable-users", getAssignableUsers);
router.get("/statistics", getWorkStatistics);
router.get("/my-work", getMyWork);
router.get("/", getAllWork);
router.delete("/bulk-delete", bulkDeleteWork);
router.get("/:id", getWorkById);
router.get("/work-id/:work_id", getWorkByWorkId);
router.put("/:id/status", updateWorkStatus);
router.post("/:id/progress-note", addProgressNote);

router.put("/:id", updateWork);

router.delete("/:id", deleteWork);

export default router;