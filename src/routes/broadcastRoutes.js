import express from 'express';
import {
    createBroadcast,
    getAllBroadcasts,
    getMemberTypeAllBroadcasts,
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
import upload, { convertToWebp } from "../middlewares/multer.js";

const router = express.Router();

router.post('/create', upload.single('file'), convertToWebp, authMiddleware, createBroadcast);
router.get('/', authMiddleware, getAllBroadcasts);
router.get('/member-type/', authMiddleware, getMemberTypeAllBroadcasts);
router.get('/statistics', authMiddleware, getBroadcastStatistics);
router.get('/receiver/:receiver_type', authMiddleware, getBroadcastsByReceiverType);
router.post('/bulk-delete', authMiddleware, bulkDeleteBroadcasts);
router.get('/broadcast-id/:broadcast_id', authMiddleware, getBroadcastByBroadcastId);
router.get('/:id', getBroadcastById);
router.put('/:id', upload.single("file"), convertToWebp, authMiddleware, updateBroadcast);
router.patch('/:id/status', authMiddleware, updateBroadcastStatus);
router.delete('/:id', authMiddleware, deleteBroadcast);

export default router;