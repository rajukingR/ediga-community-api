import express from 'express';
import authMiddleware from "../middlewares/authMiddleware.js";
import upload from "../middlewares/multer.js";

import {
  createMember,
  getMembers,
  getActiveMembers,
  getMemberById,
  updateMember,
  deleteMember
} from "../controllers/membersController.js";

const router = express.Router();

router.post('/create', authMiddleware, upload.single('profile_image'), createMember);
router.get('/', authMiddleware, getMembers);
router.get('/active', authMiddleware, getActiveMembers);
router.get('/:id', authMiddleware, getMemberById);
router.put('/:id', authMiddleware, upload.single('profile_image'), updateMember);
router.delete('/:id', authMiddleware, deleteMember);

export default router;
