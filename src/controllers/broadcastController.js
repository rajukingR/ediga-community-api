import db from "../models/index.js";
import { Op, Sequelize } from "sequelize";
import nodemailer from "nodemailer";
import { sendPushToUser } from "../services/pushService.js";

const Broadcast = db.Broadcast;
const User = db.User;
const Notification = db.Notification;
const FcmToken = db.FcmToken;

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const createBroadcast = async (req, res) => {
    try {
        const {
            broadcast_id,
            title,
            description,
            receiver,
            user_ids,
        } = req.body;

        const status = "sent";
        const file = req.file;

        // ------------------------------------------------------------------
        // 1. Determine target users
        // ------------------------------------------------------------------
        let targetUsers = [];
        let usedUserIds = false;
        let parsedUserIds = null;
        let parsedReceiver = null;

        // Parse receiver (if provided) – may be used for storage/logging
        if (receiver) {
            if (typeof receiver === "string") {
                try {
                    parsedReceiver = JSON.parse(receiver);
                } catch (e) {
                    parsedReceiver = receiver.split(",");
                }
            } else if (Array.isArray(receiver)) {
                parsedReceiver = receiver;
            }
            // Validate receiver types
            const validTypes = ["member", "volunteer_member", "professional_volunteer", "admin"];
            if (parsedReceiver && parsedReceiver.length > 0) {
                const invalidTypes = parsedReceiver.filter(type => !validTypes.includes(type));
                if (invalidTypes.length) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid receiver types: ${invalidTypes.join(", ")}`,
                    });
                }
            }
        }

        // CASE A: user_ids provided (priority)
        if (user_ids) {
            // Parse user_ids (JSON string or comma-separated)
            if (typeof user_ids === "string") {
                try {
                    parsedUserIds = JSON.parse(user_ids);
                } catch (e) {
                    parsedUserIds = user_ids.split(",").map(id => parseInt(id.trim()));
                }
            } else if (Array.isArray(user_ids)) {
                parsedUserIds = user_ids;
            }

            if (!parsedUserIds || parsedUserIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "user_ids must be a non-empty array",
                });
            }

            targetUsers = await User.findAll({
                where: {
                    id: { [Op.in]: parsedUserIds },
                    status: "approved",
                    is_active: true,
                },
                attributes: ['id', 'full_name', 'email', 'member_type']
            });

            if (targetUsers.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "No active approved users found for the given IDs",
                });
            }
            usedUserIds = true;
        }
        // CASE B: only receiver provided (fallback to old behaviour)
        else if (receiver && (!user_ids)) {
            if (!parsedReceiver || parsedReceiver.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Receiver must be a non-empty array with valid types",
                });
            }

            targetUsers = await User.findAll({
                where: {
                    member_type: { [Op.in]: parsedReceiver },
                    status: "approved",
                    is_active: true,
                },
                attributes: ['id', 'full_name', 'email', 'member_type']
            });
        }
        else {
            return res.status(400).json({
                success: false,
                message: "Either 'user_ids' or 'receiver' must be provided",
            });
        }

        if (targetUsers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No eligible users found for this broadcast",
            });
        }

        // ------------------------------------------------------------------
        // 2. Create broadcast record
        // ------------------------------------------------------------------
        let image = file ? file.filename : null;

        const broadcastData = {
            broadcast_id,
            title,
            description,
            image,
            status,
            created_by: req.user?.id || null,
        };

        if (usedUserIds) {
            // Store the selected member types (receiver) as is (for audit)
            // and also store the specific user IDs in target_user_ids
            broadcastData.receiver = parsedReceiver || [];
            broadcastData.target_user_ids = parsedUserIds;
        } else {
            // Old flow: store receiver types only
            broadcastData.receiver = parsedReceiver;
        }

        const broadcast = await Broadcast.create(broadcastData);

        // ------------------------------------------------------------------
        // 3. Send notifications, emails, pushes to each user
        // ------------------------------------------------------------------
        let emailSentCount = 0;
        let notificationSentCount = 0;
        let pushSentCount = 0;
        let failedEmails = [];
        let failedPush = [];

        for (const user of targetUsers) {
            try {
                // In-app notification
                await Notification.create({
                    user_id: user.id,
                    message: title,
                    message_type: "broadcast",
                    is_read: 0,
                    detail: {
                        broadcast_id: broadcast.id,
                        broadcast_title: title,
                        description: description,
                        image: image
                    },
                    photo: image || "bell-icon.webp"
                });
                notificationSentCount++;

                // Email
                const emailHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                line-height: 1.6;
                                color: #333;
                                max-width: 600px;
                                margin: 0 auto;
                                padding: 20px;
                            }
                            .header {
                                background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                                color: white;
                                padding: 30px;
                                text-align: center;
                                border-radius: 10px 10px 0 0;
                            }
                            .content {
                                background: #f9fafb;
                                padding: 30px;
                                border-radius: 0 0 10px 10px;
                                border: 1px solid #e5e7eb;
                                border-top: none;
                            }
                            .message-box {
                                background: white;
                                padding: 20px;
                                border-radius: 8px;
                                margin: 20px 0;
                                border-left: 4px solid #3b82f6;
                            }
                            .footer {
                                text-align: center;
                                margin-top: 20px;
                                font-size: 12px;
                                color: #6b7280;
                            }
                            .button {
                                display: inline-block;
                                background: #3b82f6;
                                color: white;
                                padding: 10px 20px;
                                text-decoration: none;
                                border-radius: 6px;
                                margin-top: 15px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>📢 Community Broadcast</h1>
                            <p>Important Announcement from Ediga Community</p>
                        </div>
                        
                        <div class="content">
                            <p>Dear <strong>${user.full_name}</strong>,</p>
                            
                            <div class="message-box">
                                <h2 style="margin-top: 0; color: #2563eb;">${title}</h2>
                                <p style="white-space: pre-line;">${description}</p>
                                ${image ? `<div style="text-align: center; margin: 15px 0;">
                                    <img src="${process.env.IMAGE_API_URL}/broadcasts/${image}" alt="Broadcast Image" style="max-width: 100%; border-radius: 8px;">
                                </div>` : ''}
                            </div>
                            
                            <p>Please log in to the community portal for more details.</p>
                            
                            <center>
                                <a href="${process.env.FRONTEND_URL}/dashboard/broadcasts" class="button">
                                    View All Broadcasts
                                </a>
                            </center>
                            
                            <hr style="margin: 20px 0;">
                            
                            <p>Best regards,<br>
                            <strong>Ediga Community Team</strong></p>
                        </div>
                        
                        <div class="footer">
                            <p>© 2025 Ediga Community. All rights reserved.</p>
                            <p>This is an automated message, please do not reply directly to this email.</p>
                        </div>
                    </body>
                    </html>
                `;

                await transporter.sendMail({
                    from: `"Ediga Community" <${process.env.EMAIL_USER}>`,
                    to: user.email,
                    subject: `📢 Community Broadcast: ${title}`,
                    html: emailHtml
                });
                emailSentCount++;

                // Push notifications (non-blocking)
                const fcmTokens = await FcmToken.findAll({
                    where: { user_id: user.id },
                    attributes: ['token']
                });

                if (fcmTokens.length > 0) {
                    const pushPromises = fcmTokens.map(async (fcmToken) => {
                        try {
                            await sendPushToUser({
                                userId: user.id,
                                title: "📢 New Broadcast",
                                body: title.length > 100 ? title.substring(0, 97) + "..." : title,
                                click_action: `${process.env.FRONTEND_URL}/dashboard/broadcasts`,
                                icon: "https://edigacommunity.innogenx.co.in/logo.webp",
                                data: {
                                    type: "broadcast",
                                    broadcast_id: String(broadcast.id),
                                    broadcast_title: String(title),
                                    description: String(description),
                                    image: image || null,
                                    receiver_type: usedUserIds ? "specific_users" : user.member_type,
                                    timestamp: new Date().toISOString()
                                }
                            });
                            pushSentCount++;
                        } catch (pushError) {
                            failedPush.push({
                                user_id: user.id,
                                email: user.email,
                                token: fcmToken.token.substring(0, 20) + "...",
                                error: pushError.message
                            });
                        }
                    });
                    Promise.allSettled(pushPromises).catch(err => console.error("Push batch error:", err.message));
                } else {
                    failedPush.push({ user_id: user.id, email: user.email, error: "No active FCM tokens" });
                }

            } catch (userError) {
                console.error(`Failed for user ${user.id}:`, userError);
                failedEmails.push({ user_id: user.id, email: user.email, error: userError.message });
            }
        }

        return res.status(201).json({
            success: true,
            message: "Broadcast created and sent successfully",
            data: broadcast,
            stats: {
                total_users: targetUsers.length,
                notifications_sent: notificationSentCount,
                emails_sent: emailSentCount,
                push_sent: pushSentCount,
                failed_emails: failedEmails.length,
                failed_push: failedPush.length,
            }
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


export const getMemberTypeAllBroadcasts = async (req, res) => {
    try {

        // Logged in user
        const user = req.user;

        // member / volunteer_member / professional_volunteer
        const memberType = user.member_type;

        // =========================
        // GET BROADCASTS
        // =========================
        const broadcasts = await Broadcast.findAll({
            where: {
                status: "sent",

                [Op.and]: [
                    Sequelize.literal(
                        `JSON_CONTAINS(receiver, '["${memberType}"]')`
                    )
                ]
            },

            order: [["id", "DESC"]]
        });

        return res.status(200).json({
            success: true,
            total: broadcasts.length,
            data: broadcasts
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
   GET BROADCAST BY ID (with recipient users)
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

        // Convert plain broadcast to object
        const broadcastData = broadcast.toJSON();

        // If there are target_user_ids, fetch the corresponding users
        if (broadcast.target_user_ids && Array.isArray(broadcast.target_user_ids) && broadcast.target_user_ids.length > 0) {
            const users = await User.findAll({
                where: {
                    id: { [Op.in]: broadcast.target_user_ids },
                    status: "approved",
                    is_active: 1,
                },
                attributes: ['id', 'full_name', 'email', 'mobile_1', 'district', 'member_type']
            });

            // Map users by id for quick lookup
            const userMap = {};
            users.forEach(user => {
                userMap[user.id] = user;
            });

            // Add full user objects to the response
            broadcastData.recipient_users = broadcast.target_user_ids.map(userId => userMap[userId] || null).filter(u => u);
        } else {
            broadcastData.recipient_users = [];
        }

        return res.status(200).json({
            success: true,
            data: broadcastData,
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

export const updateBroadcast = async (req, res) => {
    try {
        const { id } = req.params;

        let {
            broadcast_id,
            title,
            description,
            receiver,
            user_ids,
            status,
            remove_file,
        } = req.body;

        // Find broadcast
        const broadcast = await Broadcast.findByPk(id);

        if (!broadcast) {
            return res.status(404).json({
                success: false,
                message: "Broadcast not found",
            });
        }

        // Parse receiver (if provided)
        let parsedReceiver = null;
        if (receiver) {
            if (typeof receiver === "string") {
                try {
                    parsedReceiver = JSON.parse(receiver);
                } catch (err) {
                    parsedReceiver = receiver.split(",");
                }
            } else if (Array.isArray(receiver)) {
                parsedReceiver = receiver;
            }

            // Validate receiver types
            if (parsedReceiver && parsedReceiver.length > 0) {
                const validTypes = [
                    "member",
                    "volunteer_member",
                    "professional_volunteer",
                    "admin"
                ];
                const invalidTypes = parsedReceiver.filter(
                    (type) => !validTypes.includes(type)
                );
                if (invalidTypes.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid receiver types: ${invalidTypes.join(", ")}`,
                    });
                }
            }
        }

        // Parse user_ids (if provided)
        let parsedUserIds = null;
        if (user_ids) {
            if (typeof user_ids === "string") {
                try {
                    parsedUserIds = JSON.parse(user_ids);
                } catch (err) {
                    parsedUserIds = user_ids.split(",").map(id => parseInt(id.trim()));
                }
            } else if (Array.isArray(user_ids)) {
                parsedUserIds = user_ids;
            }

            // Validate user_ids are numbers
            if (parsedUserIds && parsedUserIds.length > 0) {
                const isValidNumbers = parsedUserIds.every(id => !isNaN(parseInt(id)));
                if (!isValidNumbers) {
                    return res.status(400).json({
                        success: false,
                        message: "user_ids must contain valid numeric IDs",
                    });
                }
            }
        }

        // Clean status
        let cleanedStatus = status;
        if (cleanedStatus) {
            cleanedStatus = cleanedStatus.trim().replace(/'/g, "");
        }

        // Validate status
        const validStatus = [
            "draft",
            "scheduled",
            "sent",
            "failed",
            "cancelled",
        ];

        if (cleanedStatus && !validStatus.includes(cleanedStatus)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status value",
            });
        }

        // Prepare update data
        const updateData = {
            updated_at: new Date(),
        };

        // Update basic fields
        if (broadcast_id !== undefined) {
            updateData.broadcast_id = broadcast_id;
        }

        if (title !== undefined) {
            updateData.title = title;
        }

        if (description !== undefined) {
            updateData.description = description;
        }

        if (cleanedStatus !== undefined) {
            updateData.status = cleanedStatus;
        }

        // Update receiver field
        if (parsedReceiver !== null) {
            updateData.receiver = parsedReceiver;
        }

        // Update user_ids field (specific users)
        if (parsedUserIds !== null) {
            updateData.target_user_ids = parsedUserIds;
        }

        // Handle file upload
        if (req.file) {
            // Delete old file if exists
            if (broadcast.image) {
                const fs = await import('fs');
                const path = await import('path');
                const oldFilePath = path.join(process.cwd(), 'uploads', broadcast.image);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }
            updateData.image = req.file.filename;
        }

        // Remove file if requested
        if (remove_file === "true") {
            // Delete existing file from storage
            if (broadcast.image) {
                const fs = await import('fs');
                const path = await import('path');
                const filePath = path.join(process.cwd(), 'uploads', broadcast.image);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            updateData.image = null;
        }

        console.log("UPDATE DATA =>", updateData);

        // Update broadcast
        await broadcast.update(updateData);

        // Get updated data with recipient users if needed
        const updatedBroadcast = await Broadcast.findByPk(id);
        const broadcastData = updatedBroadcast.toJSON();

        // If there are target_user_ids, fetch the corresponding users for response
        if (broadcastData.target_user_ids && Array.isArray(broadcastData.target_user_ids) && broadcastData.target_user_ids.length > 0) {
            const users = await User.findAll({
                where: {
                    id: { [Op.in]: broadcastData.target_user_ids },
                    status: "approved",
                    is_active: 1,
                },
                attributes: ['id', 'full_name', 'email', 'mobile_1', 'district', 'member_type']
            });

            const userMap = {};
            users.forEach(user => {
                userMap[user.id] = user;
            });

            broadcastData.recipient_users = broadcastData.target_user_ids
                .map(userId => userMap[userId] || null)
                .filter(u => u);
        } else {
            broadcastData.recipient_users = [];
        }

        return res.status(200).json({
            success: true,
            message: "Broadcast updated successfully",
            data: broadcastData,
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