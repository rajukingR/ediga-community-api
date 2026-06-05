import express from "express";
import {
    saveFcmToken,
    deleteFcmToken,
} from "../controllers/fcmController.js";

import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post(
    "/save-token",
    authMiddleware,
    saveFcmToken
);

router.delete(
    "/delete-token",
    authMiddleware,
    deleteFcmToken
);

export default router;