import { sendPushToAllUsers } from "../services/push.service.js";
import UserProfile from "../models/user.model.js";
export const savePushToken = async (req, res) => {
  try {
    const { userId, expoPushToken } = req.body;

    if (!userId || !expoPushToken) {
      return res.status(400).json({
        success: false,
        error: "userId and expoPushToken required",
      });
    }

    const userProfile = await UserProfile.findOneAndUpdate(
      { userId },
      { $set: { expoPushToken } },
      { new: true },
    );

    if (!userProfile) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Push token saved successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const sendNotificationToAll = async (req, res) => {
  try {
    const users = await UserProfile.find({
      expoPushToken: { $exists: true, $ne: null },
    });

    const tokens = users.map((u) => u.expoPushToken);

    await sendPushToAllUsers(tokens);

    res.json({
      success: true,
      message: "Notifications sent successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
