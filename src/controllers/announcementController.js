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
        let memberTypeIds = null;

        // Parse receiver (now contains member_type IDs)
        if (receiver) {
            if (typeof receiver === "string") {
                try {
                    parsedReceiver = JSON.parse(receiver);
                } catch (e) {
                    parsedReceiver = receiver.split(",").map(id => parseInt(id.trim()));
                }
            } else if (Array.isArray(receiver)) {
                parsedReceiver = receiver;
            }

            // Store member type IDs for later use
            memberTypeIds = parsedReceiver;
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
                attributes: ['id', 'full_name', 'email1', 'member_type_id']
            });

            if (targetUsers.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "No active approved users found for the given IDs",
                });
            }
            usedUserIds = true;
        }
        // CASE B: only receiver (member_type_ids) provided
        else if (receiver && (!user_ids)) {
            if (!parsedReceiver || parsedReceiver.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Receiver must be a non-empty array with valid member type IDs",
                });
            }

            // Validate that all member type IDs exist in the database
            const validMemberTypes = await db.MemberType.findAll({
                where: {
                    id: { [Op.in]: parsedReceiver },
                    is_active: true
                },
                attributes: ['id']
            });

            const validIds = validMemberTypes.map(mt => mt.id);
            const invalidIds = parsedReceiver.filter(id => !validIds.includes(id));

            if (invalidIds.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid member type IDs: ${invalidIds.join(", ")}. Please provide valid member type IDs.`,
                });
            }

            // Fetch users with the given member_type_ids
            targetUsers = await User.findAll({
                where: {
                    member_type_id: { [Op.in]: parsedReceiver },
                    status: "approved",
                    is_active: true,
                },
                attributes: ['id', 'full_name', 'email1', 'member_type_id']
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
            // Store the selected member type IDs (receiver) for audit
            // and also store the specific user IDs in target_user_ids
            announcementData.receiver = memberTypeIds || [];   // Store IDs instead of names
            announcementData.target_user_ids = parsedUserIds;
        } else {
            // Store receiver IDs only
            announcementData.receiver = memberTypeIds || [];
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

        // Email HTML template
        const getEmailHtml = (userName, title, description, filePath) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f3ee; border-radius: 10px;">
                <div style="background: linear-gradient(135deg, #f97316, #ea580c); padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">📢 Community Announcement</h1>
                </div>
                <div style="background: white; padding: 20px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h2 style="color: #f97316; margin-top: 0;">${title}</h2>
                    <p style="color: #333; line-height: 1.6; font-size: 16px;">Dear ${userName},</p>
                    <p style="color: #333; line-height: 1.6; font-size: 16px;">${description}</p>
                    ${filePath ? `<div style="margin: 20px 0; padding: 15px; background: #f0f0f0; border-radius: 5px;">
                        <p style="margin: 0; color: #555;">📎 Attachment: ${filePath}</p>
                    </div>` : ''}
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #888; font-size: 14px;">
                        <p>Visit your dashboard for more details: <a href="${process.env.FRONTEND_URL}/dashboard/announcements" style="color: #f97316; text-decoration: none;">View Announcements</a></p>
                        <p style="margin-top: 10px;">© ${new Date().getFullYear()} Ediga Community</p>
                    </div>
                </div>
            </div>
        `;

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
                    to: user.email1,
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
                                    receiver_type: usedUserIds ? "specific_users" : "member_type_" + user.member_type_id,
                                    timestamp: new Date().toISOString()
                                }
                            });
                            pushSentCount++;
                        } catch (pushError) {
                            failedPush.push({
                                user_id: user.id,
                                email1: user.email1,
                                token: fcmToken.token.substring(0, 20) + "...",
                                error: pushError.message
                            });
                        }
                    });
                    Promise.allSettled(pushPromises).catch(err => console.error("Push batch error:", err.message));
                } else {
                    failedPush.push({ user_id: user.id, email1: user.email1, error: "No active FCM tokens" });
                }

            } catch (userError) {
                console.error(`Failed for user ${user.id}:`, userError);
                failedEmails.push({ user_id: user.id, email1: user.email1, error: userError.message });
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
        let { page = 1, limit = 10, receiver, search } = req.query;

        const loginUserId = req.user.id;
        const isAdmin = req.user.member_type_id === null;

        page = Number(page);
        limit = Number(limit);
        const offset = (page - 1) * limit;

        // Build where clause
        let where = {};

        // For non-admin users, filter by target_user_ids containing their ID
        if (!isAdmin) {
            // Non-admin users can only see announcements where they are in target_user_ids
            where.target_user_ids = {
                [Op.and]: [
                    Sequelize.literal(`JSON_CONTAINS(target_user_ids, '${loginUserId}')`)
                ]
            };
        }

        // Handle receiver filter (only for admin users)
        if (isAdmin && receiver && receiver !== 'all' && receiver !== '') {
            const receiverId = parseInt(receiver);
            if (!isNaN(receiverId) && receiverId > 0) {
                // For MySQL, use JSON_CONTAINS with literal
                where.receiver = {
                    [Op.and]: [
                        Sequelize.literal(`JSON_CONTAINS(receiver, '${receiverId}')`)
                    ]
                };
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Invalid receiver ID. Must be a positive integer.",
                });
            }
        }

        // Search filter (applies to both admin and non-admin)
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
            filters: {
                receiver: receiver || 'all',
                search: search || null,
                user_type: isAdmin ? 'admin' : 'non-admin',
                user_id: loginUserId
            },
            data: rows,
        });

    } catch (error) {
        console.error("Error fetching announcements:", error);
        return res.status(500).json({
            success: false,
            message: "Error fetching announcements",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
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

        // Get member_type_id from user
        const memberTypeId = user.member_type_id;

        // Get announcements for this member type ID
        const announcements = await Announcement.findAll({
            where: {
                [Op.and]: [
                    Sequelize.literal(
                        `JSON_CONTAINS(receiver, '["${memberTypeId}"]')`
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

/* ======================================================
   GET ANNOUNCEMENT BY ID
====================================================== */
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
                attributes: ['id', 'full_name', 'email1', 'mobile1', 'district', 'member_type_id']
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
            user_ids,  // ADD THIS - user_ids is being received but not used
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

        // Parse receiver (now contains IDs)
        let parsedReceiver = null;
        if (receiver) {
            if (typeof receiver === "string") {
                try {
                    parsedReceiver = JSON.parse(receiver);
                } catch (err) {
                    parsedReceiver = receiver.split(",").map(id => parseInt(id.trim()));
                }
            } else if (Array.isArray(receiver)) {
                parsedReceiver = receiver;
            }

            // Validate receiver (check if they are valid member type IDs)
            if (parsedReceiver && parsedReceiver.length > 0) {
                const validMemberTypes = await db.MemberType.findAll({
                    where: {
                        id: { [Op.in]: parsedReceiver },
                        is_active: true
                    },
                    attributes: ['id']
                });

                const validIds = validMemberTypes.map(mt => mt.id);
                const invalidIds = parsedReceiver.filter(id => !validIds.includes(id));

                if (invalidIds.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid member type IDs: ${invalidIds.join(", ")}`,
                    });
                }
            }
        }

        // Parse user_ids (specific users)
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

        // Update receiver field (store IDs)
        if (parsedReceiver !== null) {
            updateData.receiver = parsedReceiver;
        }

        // Update user_ids field (specific users)
        if (parsedUserIds !== null) {
            updateData.target_user_ids = parsedUserIds;
        }

        // File upload
        if (req.file) {
            // Delete old file if exists
            if (announcement.file) {
                const fs = await import('fs');
                const path = await import('path');
                const oldFilePath = path.join(process.cwd(), 'uploads', announcement.file);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                }
            }
            updateData.file = req.file.filename;
        }

        // Remove file
        if (remove_file === "true") {
            // Delete existing file from storage
            if (announcement.file) {
                const fs = await import('fs');
                const path = await import('path');
                const filePath = path.join(process.cwd(), 'uploads', announcement.file);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
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
   GET ANNOUNCEMENTS BY RECEIVER TYPE (ID)
====================================================== */
export const getAnnouncementsByReceiverType = async (req, res) => {
    try {
        const { receiver_type } = req.params;
        let { page = 1, limit = 10 } = req.query;

        // receiver_type is now an ID
        const receiverTypeId = parseInt(receiver_type);

        // Validate if the member type exists
        const memberType = await db.MemberType.findByPk(receiverTypeId);
        if (!memberType) {
            return res.status(400).json({
                success: false,
                message: `Invalid member type ID: ${receiver_type}`
            });
        }

        page = Number(page);
        limit = Number(limit);
        const offset = (page - 1) * limit;

        let where = {
            receiver: {
                [Op.contains]: [receiverTypeId]
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

        // Get all member types
        const memberTypes = await db.MemberType.findAll({
            where: { is_active: true },
            attributes: ['id', 'member_type_name']
        });

        // Get counts by receiver type (using IDs)
        const byReceiverType = {};
        for (const mt of memberTypes) {
            const count = await Announcement.count({
                where: {
                    receiver: {
                        [Op.contains]: [mt.id]
                    }
                }
            });
            byReceiverType[mt.member_type_name] = count;
        }

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
                by_receiver_type: byReceiverType,
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