import express from 'express';
import authMiddleware from "../../middlewares/authMiddleware.js";
import upload from "../../middlewares/multer.js";

import {
  signup,
  signin,
  sendResetPasswordLink,
  resetPassword,
  checkResetToken,
  getAllUsers,
  getAllPendingUsers,
  getAllMembers,
  getAllVolunteerMembers,
  getAllProfessionalVolunteers,
  getActiveProfessionalVolunteers,
  getActiveUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  deleteUser
} from '../../controllers/auth_controller/authController.js';

const router = express.Router();

router.post(
  '/signup',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'document_file', maxCount: 1 }
  ]),
  signup
);

router.post('/signin', signin);
router.post('/reset-password-link', sendResetPasswordLink);
router.post('/forgot-password', resetPassword);
router.post("/check-reset-token", checkResetToken);

router.get('/', authMiddleware, getAllUsers);
// Add this route to your userRoutes.js

// Get all pending users (excluding admin)
router.get('/pending', authMiddleware, getAllPendingUsers);
// Add these routes to your userRoutes.js

// Member type specific routes (only approved users)
router.get('/members', authMiddleware, getAllMembers);
router.get('/volunteer-members', authMiddleware, getAllVolunteerMembers);
router.get('/professional-volunteers', authMiddleware, getAllProfessionalVolunteers);

router.get("/professional-volunteers/active", authMiddleware, getActiveProfessionalVolunteers);
router.get("/active", authMiddleware, getActiveUsers);
router.patch('/:id/status', authMiddleware, updateUserStatus); // Add this route

router.get('/:id', authMiddleware, getUserById);

router.put('/:id', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'document_file', maxCount: 1 }
]), authMiddleware, updateUser);

router.delete('/:id', authMiddleware, deleteUser);

export default router;
