import express from 'express';
import authMiddleware from "../../middlewares/authMiddleware.js";
import upload, { convertToWebp } from "../../middlewares/multer.js";

import {
  signup,
  signin,
  sendResetPasswordLink,
  checkResetToken,
  verifyPhoneNumber,
  verifyOtp,
  resendOtp,
  resetPassword,
  checkMobileExists,
  verifyDob,
  resetPasswordWithPhone,
  sendEmailOTP,      // Add this
  verifyEmailOTP,    // Add this
  resendEmailOTP,     // Add this
  getAllUsers,
  sendMobileNumber,
  getAllPendingUsers,
  getAllRejectedUsers,
  getAllMembers,
  getAllVolunteerMembers,
  getAllProfessionalVolunteers,
  getActiveProfessionalVolunteers,
  getActiveVolunteerMembers,
  getActiveUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  deleteUser
} from '../../controllers/auth_controller/authController.js';

const router = express.Router();

router.post(
  "/signup",
  upload.fields([
    { name: "member_photo", maxCount: 1 },
    { name: "document_file", maxCount: 1 },
    { name: "aadhar_document_file", maxCount: 1 },
    { name: "voter_document_file", maxCount: 1 },
  ]),
  convertToWebp,
  signup
);

router.post('/signin', signin);
router.post('/reset-password-link', sendResetPasswordLink);
// router.post('/forgot-password', resetPassword);
router.post("/check-reset-token", checkResetToken);
// Phone-based password reset routes
router.post('/verify-phone', verifyPhoneNumber);
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/reset-password', resetPassword);
router.get('/check-mobile/:mobileNumber', checkMobileExists);
router.post('/verify-dob', verifyDob);  // NEW
router.post('/reset-password-phone', resetPasswordWithPhone);

router.post("/send-email1-otp", sendEmailOTP);
router.post("/verify-email1-otp", verifyEmailOTP);
router.post("/resend-email1-otp", resendEmailOTP);

router.get('/', authMiddleware, getAllUsers);
// Add this route to your userRoutes.js

// Get all pending users (excluding admin)
router.get('/pending', authMiddleware, getAllPendingUsers);
router.get('/rejected', authMiddleware, getAllRejectedUsers);

// Add these routes to your userRoutes.js

// Member type specific routes (only approved users)
router.get('/members', authMiddleware, getAllMembers);
router.post("/mobile-number", sendMobileNumber);
router.get('/volunteer-members', authMiddleware, getAllVolunteerMembers);
router.get('/professional-volunteers', authMiddleware, getAllProfessionalVolunteers);

// router.get("/professional-volunteers/active", authMiddleware, getActiveProfessionalVolunteers);
// router.get("/volunteer-members/active", authMiddleware, getActiveVolunteerMembers);

// routes/authRoutes.js
router.get("/member_type_id=2/active", authMiddleware, getActiveProfessionalVolunteers);
router.get("/member_type_id=3/active", authMiddleware, getActiveVolunteerMembers);

router.get("/active", authMiddleware, getActiveUsers);
router.patch('/:id/status', authMiddleware, updateUserStatus); // Add this route

router.get('/:id', getUserById);

router.put(
  "/:id",
  upload.fields([
    { name: "member_photo", maxCount: 1 },
    { name: "document_file", maxCount: 1 },
    { name: "aadhar_document_file", maxCount: 1 },
    { name: "voter_document_file", maxCount: 1 },
  ]),
  convertToWebp,
  updateUser
);

router.delete('/:id', authMiddleware, deleteUser);

export default router;
