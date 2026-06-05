import db from "../models/index.js";

const FcmToken = db.FcmToken;

// Save FCM Token
export const saveFcmToken = async (req, res) => {
    try {
        const { token } = req.body;
        const user_id = req.user.id;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "FCM token is required",
            });
        }

        // Check if token already exists
        const existingToken = await FcmToken.findOne({
            where: { token },
        });

        if (existingToken) {
            await existingToken.update({
                user_id,
            });

            return res.status(200).json({
                success: true,
                message: "FCM token updated successfully",
            });
        }

        await FcmToken.create({
            user_id,
            token,
        });

        return res.status(201).json({
            success: true,
            message: "FCM token saved successfully",
        });
    } catch (error) {
        console.error("Save FCM Token Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to save FCM token",
            error: error.message,
        });
    }
};

// Delete FCM Token (Logout)
export const deleteFcmToken = async (req, res) => {
    try {
        const { token } = req.body;

        await FcmToken.destroy({
            where: { token },
        });

        return res.status(200).json({
            success: true,
            message: "FCM token deleted successfully",
        });
    } catch (error) {
        console.error("Delete FCM Token Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete FCM token",
            error: error.message,
        });
    }
};