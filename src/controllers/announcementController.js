import db from "../models/index.js";
import { Op, Sequelize } from "sequelize";
import nodemailer from "nodemailer";
import { sendPushToUser } from "../services/pushService.js";

const Announcement = db.Announcement;
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

export const createAnnouncement = async (req, res) => {
    try {
        const {
            announcement_id,
            title,
            description,
            receiver,
            user_ids,
        } = req.body;

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
            // Validate receiver types (optional, but keeps consistency)
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
                message: "No eligible users found for this announcement",
            });
        }

        // ------------------------------------------------------------------
        // 2. Create announcement record
        // ------------------------------------------------------------------
        let filePath = file ? file.filename : null;

        const announcementData = {
            announcement_id,
            title,
            description,
            file: filePath,
        };

        if (usedUserIds) {
            // Store the selected member types (receiver) as is (for audit)
            // and also store the specific user IDs in target_user_ids
            announcementData.receiver = parsedReceiver || [];   // may be empty if none selected
            announcementData.target_user_ids = parsedUserIds;
        } else {
            // Old flow: store receiver types only
            announcementData.receiver = parsedReceiver;
        }

        const announcement = await Announcement.create(announcementData);

        // ------------------------------------------------------------------
        // 3. Send notifications, emails, pushes to each user
        // ------------------------------------------------------------------
        let emailSentCount = 0;
        let notificationSentCount = 0;
        let pushSentCount = 0;
        let failedEmails = [];
        let failedPush = [];

        // Reuse your existing email HTML template (replace placeholder)
        const getEmailHtml = (userName, title, description, filePath) => `...`; // your template

        for (const user of targetUsers) {
            try {
                // In-app notification
                await Notification.create({
                    user_id: user.id,
                    message: title,
                    message_type: "announcement",
                    is_read: 0,
                    detail: {
                        announcement_id: announcement.id,
                        announcement_title: title,
                        description: description,
                        file: filePath
                    },
                    photo: filePath || "bell-icon.webp"
                });
                notificationSentCount++;

                // Email
                const emailHtml = getEmailHtml(user.full_name, title, description, filePath);
                await transporter.sendMail({
                    from: `"Ediga Community" <${process.env.EMAIL_USER}>`,
                    to: user.email,
                    subject: `📢 Community Announcement: ${title}`,
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
                                title: "📢 New Announcement",
                                body: title.length > 100 ? title.substring(0, 97) + "..." : title,
                                click_action: `${process.env.FRONTEND_URL}/dashboard/announcements`,
                                icon: "https://edigacommunity.innogenx.co.in/logo.webp",
                                data: {
                                    type: "announcement",
                                    announcement_id: String(announcement.id),
                                    announcement_title: String(title),
                                    description: String(description),
                                    file: filePath || null,
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
            message: "Announcement created and sent successfully",
            data: announcement,
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
            message: "Error creating announcement",
            error: error.message,
        });
    }
};

/* ======================================================
   GET ALL ANNOUNCEMENTS (PAGINATION)
====================================================== */
export const getAllAnnouncements = async (req, res) => {
    try {
        let { page = 1, limit = 10, receiver_type, search } = req.query;

        page = Number(page);
        limit = Number(limit);
        const offset = (page - 1) * limit;

        // Build where clause
        let where = {};

        if (receiver_type) {
            where.receiver = {
                [Op.contains]: [receiver_type]
            };
        }

        if (search) {
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
                { announcement_id: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows } = await Announcement.findAndCountAll({
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
            message: "Error fetching announcements",
            error: error.message,
        });
    }
};

/* ======================================================
   GET MEMBER TYPE ANNOUNCEMENTS (For logged-in user)
====================================================== */
export const getMemberTypeAllAnnouncements = async (req, res) => {
    try {
        // Logged in user
        const user = req.user;

        // member / volunteer_member / professional_volunteer
        const memberType = user.member_type;

        // Get announcements for this member type
        const announcements = await Announcement.findAll({
            where: {
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
            total: announcements.length,
            data: announcements
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Error fetching announcements",
            error: error.message,
        });
    }
};

export const getAnnouncementById = async (req, res) => {
    try {
        const { id } = req.params;

        const announcement = await Announcement.findByPk(id);

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found",
            });
        }

        // Convert plain announcement to object
        const announcementData = announcement.toJSON();

        // If there are target_user_ids, fetch the corresponding users
        if (announcement.target_user_ids && Array.isArray(announcement.target_user_ids) && announcement.target_user_ids.length > 0) {
            const users = await User.findAll({
                where: {
                    id: { [Op.in]: announcement.target_user_ids },
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

            // Add full user objects to the response (optional: also keep original IDs)
            announcementData.recipient_users = announcement.target_user_ids.map(userId => userMap[userId] || null).filter(u => u);
        } else {
            announcementData.recipient_users = [];
        }

        return res.status(200).json({
            success: true,
            data: announcementData,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching announcement",
            error: error.message,
        });
    }
};

/* ======================================================
   GET ANNOUNCEMENT BY ANNOUNCEMENT_ID
====================================================== */
export const getAnnouncementByAnnouncementId = async (req, res) => {
    try {
        const { announcement_id } = req.params;

        const announcement = await Announcement.findOne({
            where: { announcement_id }
        });

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: announcement,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching announcement",
            error: error.message,
        });
    }
};

/* ======================================================
   UPDATE ANNOUNCEMENT
====================================================== */
export const updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;

        let {
            announcement_id,
            title,
            description,
            receiver,
            remove_file,
        } = req.body;

        console.log("BODY =>", req.body);
        console.log("FILE =>", req.file);

        // Find announcement
        const announcement = await Announcement.findByPk(id);

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found",
            });
        }

        // Parse receiver
        if (typeof receiver === "string") {
            try {
                receiver = JSON.parse(receiver);
            } catch (err) {
                receiver = receiver.split(",");
            }
        }

        // Validate receiver
        if (receiver) {
            const validTypes = [
                "member",
                "volunteer_member",
                "professional_volunteer",
                "admin"
            ];

            const invalidTypes = receiver.filter(
                (type) => !validTypes.includes(type)
            );

            if (invalidTypes.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid receiver types: ${invalidTypes.join(", ")}`,
                });
            }
        }

        // Prepare update data
        const updateData = {
            updated_at: new Date(),
        };

        // Update fields
        if (announcement_id !== undefined) {
            updateData.announcement_id = announcement_id;
        }

        if (title !== undefined) {
            updateData.title = title;
        }

        if (description !== undefined) {
            updateData.description = description;
        }

        if (receiver !== undefined) {
            updateData.receiver = receiver;
        }

        // File upload
        if (req.file) {
            updateData.file = req.file.filename;
        }

        // Remove file
        if (remove_file === "true") {
            updateData.file = null;
        }

        console.log("UPDATE DATA =>", updateData);

        // Update announcement
        await announcement.update(updateData);

        // Get updated data
        const updatedAnnouncement = await Announcement.findByPk(id);

        return res.status(200).json({
            success: true,
            message: "Announcement updated successfully",
            data: updatedAnnouncement,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Error updating announcement",
            error: error.message,
        });
    }
};

/* ======================================================
   DELETE ANNOUNCEMENT
====================================================== */
export const deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;

        const announcement = await Announcement.findByPk(id);

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found",
            });
        }

        await announcement.destroy();

        return res.status(200).json({
            success: true,
            message: "Announcement deleted successfully",
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error deleting announcement",
            error: error.message,
        });
    }
};

/* ======================================================
   GET ANNOUNCEMENTS BY RECEIVER TYPE
====================================================== */
export const getAnnouncementsByReceiverType = async (req, res) => {
    try {
        const { receiver_type } = req.params;
        let { page = 1, limit = 10 } = req.query;

        const validTypes = ['member', 'volunteer_member', 'professional_volunteer', 'admin'];
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

        const { count, rows } = await Announcement.findAndCountAll({
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
            message: "Error fetching announcements by receiver type",
            error: error.message,
        });
    }
};

/* ======================================================
   BULK DELETE ANNOUNCEMENTS
====================================================== */
export const bulkDeleteAnnouncements = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of announcement IDs to delete"
            });
        }

        const deleted = await Announcement.destroy({
            where: {
                id: {
                    [Op.in]: ids
                }
            }
        });

        return res.status(200).json({
            success: true,
            message: `${deleted} announcement(s) deleted successfully`,
            deletedCount: deleted
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error deleting announcements",
            error: error.message,
        });
    }
};

/* ======================================================
   GET ANNOUNCEMENT STATISTICS
====================================================== */
export const getAnnouncementStatistics = async (req, res) => {
    try {
        const totalAnnouncements = await Announcement.count();

        // Get counts by receiver type
        const memberAnnouncements = await Announcement.count({
            where: {
                receiver: {
                    [Op.contains]: ['member']
                }
            }
        });

        const volunteerMemberAnnouncements = await Announcement.count({
            where: {
                receiver: {
                    [Op.contains]: ['volunteer_member']
                }
            }
        });

        const professionalVolunteerAnnouncements = await Announcement.count({
            where: {
                receiver: {
                    [Op.contains]: ['professional_volunteer']
                }
            }
        });

        const adminAnnouncements = await Announcement.count({
            where: {
                receiver: {
                    [Op.contains]: ['admin']
                }
            }
        });

        // Get recent announcements (last 5)
        const recentAnnouncements = await Announcement.findAll({
            limit: 5,
            order: [["created_at", "DESC"]],
            attributes: ['id', 'announcement_id', 'title', 'created_at']
        });

        // Get announcements with files
        const announcementsWithFiles = await Announcement.count({
            where: {
                file: {
                    [Op.ne]: null
                }
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                total: totalAnnouncements,
                by_receiver_type: {
                    member: memberAnnouncements,
                    volunteer_member: volunteerMemberAnnouncements,
                    professional_volunteer: professionalVolunteerAnnouncements,
                    admin: adminAnnouncements
                },
                announcements_with_files: announcementsWithFiles,
                announcements_without_files: totalAnnouncements - announcementsWithFiles,
                recent_announcements: recentAnnouncements
            }
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching announcement statistics",
            error: error.message,
        });
    }
};