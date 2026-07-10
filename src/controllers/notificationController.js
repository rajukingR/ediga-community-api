import db from "../models/index.js";

const Notification = db.Notification;

// =========================
// GET USER NOTIFICATIONS
// =========================
export const getNotifications = async (req, res) => {
    try {

        // Logged in user id
        const userId = req.user.id;

        const notifications = await Notification.findAll({
            where: {
                user_id: userId
            },
            order: [["created_at", "DESC"]]
        });

        // =========================
        // UNREAD COUNT
        // =========================
        const unreadCount = await Notification.count({
            where: {
                user_id: userId,
                is_read: false // or 0 depending on your DB type
            }
        });

        return res.status(200).json({
            success: true,
            unread_count: unreadCount,
            total_count: notifications.length,
            notifications
        });

    } catch (error) {

        console.error("Get Notifications Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch notifications",
            error: error.message
        });
    }
};

// =========================
// MARK AS READ
// =========================
export const markNotificationAsRead = async (req, res) => {
    try {

        const { id } = req.params;

        const notification = await Notification.findByPk(id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        await notification.update({
            is_read: 1
        });

        return res.status(200).json({
            success: true,
            message: "Notification marked as read"
        });

    } catch (error) {

        console.error("Mark Notification Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update notification",
            error: error.message
        });
    }
};

// =========================
// DELETE NOTIFICATION
// =========================
export const deleteNotification = async (req, res) => {
    try {

        const { id } = req.params;

        const notification = await Notification.findByPk(id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found"
            });
        }

        await notification.destroy();

        return res.status(200).json({
            success: true,
            message: "Notification deleted successfully"
        });

    } catch (error) {

        console.error("Delete Notification Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete notification",
            error: error.message
        });
    }
};