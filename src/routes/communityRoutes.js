import express from 'express';
import authMiddleware from "../middlewares/authMiddleware.js";

import {
  createCommunityType,
  getCommunityTypes,
  getActiveCommunityTypes,
  getCommunityTypeById,
  updateCommunityType,
  deleteCommunityType
} from "../controllers/communityTypeController.js";

const router = express.Router();

router.post('/create', authMiddleware, createCommunityType);
router.get('/', authMiddleware, getCommunityTypes);
router.get('/active', authMiddleware, getActiveCommunityTypes);
router.get('/:id', authMiddleware, getCommunityTypeById);
router.put('/:id', authMiddleware, updateCommunityType);
router.delete('/:id', authMiddleware, deleteCommunityType);

export default router;
