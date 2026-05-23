import express from 'express';
import authRoutes from './auth_routs/authRoutes.js';

const router = express.Router();

// Define all parent routes here
router.use('/auth', authRoutes); 


export default router;