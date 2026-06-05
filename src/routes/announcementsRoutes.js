import express from 'express';
import {
    createAnnouncement,
    getAllAnnouncements,
    getMemberTypeAllAnnouncements,
    getAnnouncementById,
    getAnnouncementByAnnouncementId,
    updateAnnouncement,
    deleteAnnouncement,
    getAnnouncementsByReceiverType,
    bulkDeleteAnnouncements,
    getAnnouncementStatistics
} from '../controllers/announcementController.js';

import authMiddleware from "../middlewares/authMiddleware.js";
import upload, { convertToWebp } from "../middlewares/multer.js";

const router = express.Router();

router.post('/create', upload.single('file'), convertToWebp, authMiddleware, createAnnouncement);
router.get('/', authMiddleware, getAllAnnouncements);
router.get('/member-type/', authMiddleware, getMemberTypeAllAnnouncements);
router.get('/statistics', authMiddleware, getAnnouncementStatistics);
router.get('/receiver/:receiver_type', authMiddleware, getAnnouncementsByReceiverType);
router.post('/bulk-delete', authMiddleware, bulkDeleteAnnouncements);
router.get('/announcement-id/:announcement_id', authMiddleware, getAnnouncementByAnnouncementId);
router.get('/:id', getAnnouncementById);
router.put('/:id', upload.single("file"), convertToWebp, authMiddleware, updateAnnouncement);
router.delete('/:id', authMiddleware, deleteAnnouncement);

export default router;