import express from 'express';
import {
    createBroadcast,
    getAllBroadcasts,
    getBroadcastById,
    getBroadcastByBroadcastId,
    updateBroadcast,
    updateBroadcastStatus,
    deleteBroadcast,
    getBroadcastsByReceiverType,
    bulkDeleteBroadcasts,
    getBroadcastStatistics
} from '../controllers/broadcastController.js';

import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post('/create', authMiddleware, createBroadcast);
router.get('/', authMiddleware, getAllBroadcasts);
router.get('/statistics', authMiddleware, getBroadcastStatistics);
router.get('/receiver/:receiver_type', authMiddleware, getBroadcastsByReceiverType);
router.post('/bulk-delete', authMiddleware, bulkDeleteBroadcasts);
router.get('/broadcast-id/:broadcast_id', authMiddleware, getBroadcastByBroadcastId);
router.get('/:id', authMiddleware, getBroadcastById);
router.put('/:id', authMiddleware, updateBroadcast);
router.patch('/:id/status', authMiddleware, updateBroadcastStatus);
router.delete('/:id', authMiddleware, deleteBroadcast);

export default router;