import db from "../models/index.js";
import { Op } from "sequelize";

const Broadcast = db.Broadcast;

/* ======================================================
   CREATE BROADCAST
====================================================== */
export const createBroadcast = async (req, res) => {
    try {
        const {
            broadcast_id,
            title,
            description,
            receiver,
            status,
        } = req.body;

        // Validate receiver array
        if (!receiver || !Array.isArray(receiver) || receiver.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Receiver must be a non-empty array with valid types: member, volunteer_member, professional_volunteer"
            });
        }

        const validTypes = ['member', 'volunteer_member', 'professional_volunteer'];
        const invalidTypes = receiver.filter(type => !validTypes.includes(type));
        
        if (invalidTypes.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid receiver types: ${invalidTypes.join(', ')}. Allowed: ${validTypes.join(', ')}`
            });
        }

        const broadcast = await Broadcast.create({
            broadcast_id,
            title,
            description,
            receiver,
            status: status || 'draft',
        });

        return res.status(201).json({
            success: true,
            message: "Broadcast created successfully",
            data: broadcast,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error creating broadcast",
            error: error.message,
        });
    }
};

/* ======================================================
   GET ALL BROADCASTS (PAGINATION)
====================================================== */
export const getAllBroadcasts = async (req, res) => {
    try {
        let { page = 1, limit = 10, status, receiver_type, search } = req.query;

        page = Number(page);
        limit = Number(limit);
        const offset = (page - 1) * limit;

        // Build where clause
        let where = {};
        
        if (status) {
            where.status = status;
        }
        
        if (receiver_type) {
            where.receiver = {
                [Op.contains]: [receiver_type]
            };
        }

        if (search) {
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
                { broadcast_id: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows } = await Broadcast.findAndCountAll({
            where,
            limit,
            offset,
            order: [["id", "DESC"]],
        });

        return res.status(200).json({
            success: true,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            data: rows,
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching broadcasts",
            error: error.message,
        });
    }
};

/* ======================================================
   GET BROADCAST BY ID
====================================================== */
export const getBroadcastById = async (req, res) => {
    try {
        const { id } = req.params;

        const broadcast = await Broadcast.findByPk(id);

        if (!broadcast) {
            return res.status(404).json({
                success: false,
                message: "Broadcast not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: broadcast,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching broadcast",
            error: error.message,
        });
    }
};

/* ======================================================
   GET BROADCAST BY BROADCAST_ID
====================================================== */
export const getBroadcastByBroadcastId = async (req, res) => {
    try {
        const { broadcast_id } = req.params;

        const broadcast = await Broadcast.findOne({
            where: { broadcast_id }
        });

        if (!broadcast) {
            return res.status(404).json({
                success: false,
                message: "Broadcast not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: broadcast,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching broadcast",
            error: error.message,
        });
    }
};

/* ======================================================
   UPDATE BROADCAST
====================================================== */
export const updateBroadcast = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, receiver, status } = req.body;

        const broadcast = await Broadcast.findByPk(id);

        if (!broadcast) {
            return res.status(404).json({
                success: false,
                message: "Broadcast not found",
            });
        }

        // Validate receiver if provided
        if (receiver) {
            if (!Array.isArray(receiver)) {
                return res.status(400).json({
                    success: false,
                    message: "Receiver must be an array"
                });
            }
            
            const validTypes = ['member', 'volunteer_member', 'professional_volunteer'];
            const invalidTypes = receiver.filter(type => !validTypes.includes(type));
            
            if (invalidTypes.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid receiver types: ${invalidTypes.join(', ')}`
                });
            }
        }

        await broadcast.update({
            title: title || broadcast.title,
            description: description || broadcast.description,
            receiver: receiver || broadcast.receiver,
            status: status || broadcast.status,
            updated_at: new Date()
        });

        return res.status(200).json({
            success: true,
            message: "Broadcast updated successfully",
            data: broadcast,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error updating broadcast",
            error: error.message,
        });
    }
};

/* ======================================================
   UPDATE BROADCAST STATUS
====================================================== */
export const updateBroadcastStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['draft', 'scheduled', 'sent', 'failed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed: ${validStatuses.join(', ')}`
            });
        }

        const broadcast = await Broadcast.findByPk(id);

        if (!broadcast) {
            return res.status(404).json({
                success: false,
                message: "Broadcast not found",
            });
        }

        // Additional validation: Cannot update status if already sent
        if (broadcast.status === 'sent' && status !== 'sent') {
            return res.status(400).json({
                success: false,
                message: "Cannot change status of already sent broadcast"
            });
        }

        broadcast.status = status;
        broadcast.updated_at = new Date();
        
        // If status is changing to 'sent', set sent_at timestamp
        if (status === 'sent' && broadcast.status !== 'sent') {
            broadcast.sent_at = new Date();
        }
        
        await broadcast.save();

        return res.status(200).json({
            success: true,
            message: "Broadcast status updated successfully",
            data: broadcast,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error updating broadcast status",
            error: error.message,
        });
    }
};

/* ======================================================
   DELETE BROADCAST
====================================================== */
export const deleteBroadcast = async (req, res) => {
    try {
        const { id } = req.params;

        const broadcast = await Broadcast.findByPk(id);

        if (!broadcast) {
            return res.status(404).json({
                success: false,
                message: "Broadcast not found",
            });
        }

        // Optional: Prevent deletion of sent broadcasts
        if (broadcast.status === 'sent') {
            return res.status(400).json({
                success: false,
                message: "Cannot delete already sent broadcast"
            });
        }

        await broadcast.destroy();

        return res.status(200).json({
            success: true,
            message: "Broadcast deleted successfully",
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error deleting broadcast",
            error: error.message,
        });
    }
};

/* ======================================================
   GET BROADCASTS BY RECEIVER TYPE
====================================================== */
export const getBroadcastsByReceiverType = async (req, res) => {
    try {
        const { receiver_type } = req.params;
        let { page = 1, limit = 10, status } = req.query;

        const validTypes = ['member', 'volunteer_member', 'professional_volunteer'];
        if (!validTypes.includes(receiver_type)) {
            return res.status(400).json({
                success: false,
                message: `Invalid receiver type. Allowed: ${validTypes.join(', ')}`
            });
        }

        page = Number(page);
        limit = Number(limit);
        const offset = (page - 1) * limit;

        let where = {
            receiver: {
                [Op.contains]: [receiver_type]
            }
        };

        if (status) {
            where.status = status;
        }

        const { count, rows } = await Broadcast.findAndCountAll({
            where,
            limit,
            offset,
            order: [["created_at", "DESC"]],
        });

        return res.status(200).json({
            success: true,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            data: rows,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching broadcasts by receiver type",
            error: error.message,
        });
    }
};

/* ======================================================
   BULK DELETE BROADCASTS
====================================================== */
export const bulkDeleteBroadcasts = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of broadcast IDs to delete"
            });
        }

        // Optional: Check for sent broadcasts
        const sentBroadcasts = await Broadcast.findAll({
            where: {
                id: {
                    [Op.in]: ids
                },
                status: 'sent'
            }
        });

        if (sentBroadcasts.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete ${sentBroadcasts.length} broadcast(s) that are already sent`
            });
        }

        const deleted = await Broadcast.destroy({
            where: {
                id: {
                    [Op.in]: ids
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: `${deleted} broadcast(s) deleted successfully`,
            deletedCount: deleted
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error deleting broadcasts",
            error: error.message,
        });
    }
};

/* ======================================================
   GET BROADCAST STATISTICS
====================================================== */
export const getBroadcastStatistics = async (req, res) => {
    try {
        const totalBroadcasts = await Broadcast.count();
        const drafts = await Broadcast.count({ where: { status: 'draft' } });
        const scheduled = await Broadcast.count({ where: { status: 'scheduled' } });
        const sent = await Broadcast.count({ where: { status: 'sent' } });
        const failed = await Broadcast.count({ where: { status: 'failed' } });
        const cancelled = await Broadcast.count({ where: { status: 'cancelled' } });

        // Get counts by receiver type
        const memberBroadcasts = await Broadcast.count({
            where: {
                receiver: {
                    [Op.contains]: ['member']
                }
            }
        });
        
        const volunteerMemberBroadcasts = await Broadcast.count({
            where: {
                receiver: {
                    [Op.contains]: ['volunteer_member']
                }
            }
        });
        
        const professionalVolunteerBroadcasts = await Broadcast.count({
            where: {
                receiver: {
                    [Op.contains]: ['professional_volunteer']
                }
            }
        });

        // Get recent broadcasts (last 5)
        const recentBroadcasts = await Broadcast.findAll({
            limit: 5,
            order: [["created_at", "DESC"]],
            attributes: ['id', 'broadcast_id', 'title', 'status', 'created_at']
        });

        return res.status(200).json({
            success: true,
            data: {
                total: totalBroadcasts,
                by_status: {
                    draft: drafts,
                    scheduled: scheduled,
                    sent: sent,
                    failed: failed,
                    cancelled: cancelled
                },
                by_receiver_type: {
                    member: memberBroadcasts,
                    volunteer_member: volunteerMemberBroadcasts,
                    professional_volunteer: professionalVolunteerBroadcasts
                },
                recent_broadcasts: recentBroadcasts
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching broadcast statistics",
            error: error.message,
        });
    }
};