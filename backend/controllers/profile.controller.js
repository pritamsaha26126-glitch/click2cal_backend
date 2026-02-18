import UserProfile from "../models/user.model.js";

export const createOrUpdateProfile = async (req, res) => {
  try {
    let userId = req.user?.userId;
    const { email, userId: bodyUserId, ...otherData } = req.body;

    if (!userId && bodyUserId) {
      userId = bodyUserId;
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required to create/update profile",
      });
    }

    if (!userId) {
      userId = `temp_${Buffer.from(email).toString("base64")}`;
    }

    let userProfile = await UserProfile.findOne({
      $or: [{ userId }, { email }],
    });

    if (userProfile) {
      userProfile.email = email;
      userProfile.userId = userId;

      Object.keys(otherData).forEach((key) => {
        if (otherData[key] !== undefined) {
          userProfile[key] = otherData[key];
        }
      });

      await userProfile.save();
    } else {
      userProfile = new UserProfile({
        userId,
        email,
        ...otherData,
      });
      await userProfile.save();
    }

    res.json({
      success: true,
      message: "Profile saved successfully",
      data: userProfile,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
export const getProfile = async (req, res) => {
  try {
    const email = req.query.email;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required to fetch profile",
        data: null,
      });
    }

    let userProfile = await UserProfile.findOne({ email });

    if (!userProfile) {
      userProfile = new UserProfile({
        email,
        userId: `user_${Buffer.from(email).toString("base64").substring(0, 10)}`,
      });
      await userProfile.save();
    }

    return res.json({
      success: true,
      data: userProfile,
      error: null,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      data: null,
    });
  }
};

export const updateNutritionGoals = async (req, res) => {
  try {
    const { userId } = req.user;
    const { height, weight, age, gender, goal, activityLevel } = req.body;

    let userProfile = await UserProfile.findOne({ userId });

    if (!userProfile) {
      return res.status(404).json({
        success: false,
        error: "Profile not found",
      });
    }

    if (height !== undefined) userProfile.height = height;
    if (weight !== undefined) userProfile.weight = weight;
    if (age !== undefined) userProfile.age = age;
    if (gender !== undefined) userProfile.gender = gender;
    if (goal !== undefined) userProfile.goal = goal;
    if (activityLevel !== undefined) userProfile.activityLevel = activityLevel;

    await userProfile.save();

    res.json({
      success: true,
      message: "Nutrition goals updated",
      data: {
        dailyCalories: userProfile.dailyCalories,
        dailyProtein: userProfile.dailyProtein,
        dailyCarbs: userProfile.dailyCarbs,
        dailyFat: userProfile.dailyFat,
      },
    });
  } catch (error) {
    console.error("Update nutrition goals error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    const { userId } = req.user;
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({
        success: false,
        error: "Avatar URL is required",
      });
    }

    const userProfile = await UserProfile.findOneAndUpdate(
      { userId },
      { avatar: avatarUrl },
      { new: true, upsert: true },
    );

    res.json({
      success: true,
      message: "Avatar updated successfully",
      data: userProfile,
    });
  } catch (error) {
    console.error("Upload avatar error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
export const deleteProfile = async (req, res) => {
  try {
    const { email } = req.query;
    const { userId } = req.user;
    const { email: bodyEmail } = req.body;

    const profileEmail = email || bodyEmail || req.user?.email;

    if (!profileEmail) {
      return res.status(400).json({
        success: false,
        error: "Email is required to delete profile",
      });
    }

    console.log(`Attempting to delete user ${profileEmail} from Cognito...`);
    const cognitoResult = await deleteCognitoUser(profileEmail);

    if (!cognitoResult.success) {
      console.log(`⚠️ Cognito deletion issue: ${cognitoResult.error}`);
    }

    console.log(`Deleting profile for ${profileEmail} from MongoDB...`);
    const deletedProfile = await UserProfile.findOneAndDelete({
      email: profileEmail,
    });

    const response = {
      success: true,
      message: "Profile deletion processed",
      data: {
        email: profileEmail,
        deletedFromDatabase: !!deletedProfile,
        deletedFromCognito: cognitoResult.success,
      },
    };

    if (!deletedProfile && !cognitoResult.success) {
      return res.status(404).json({
        success: false,
        error: "Profile not found in either database or Cognito",
      });
    }

    if (!deletedProfile) {
      response.warning =
        "Profile not found in database, but Cognito deletion was processed";
    }

    if (!cognitoResult.success && cognitoResult.code !== "USER_NOT_FOUND") {
      response.warning = response.warning
        ? `${response.warning} | Cognito deletion failed: ${cognitoResult.error}`
        : `Cognito deletion failed: ${cognitoResult.error}`;
    }

    return res.json(response);
  } catch (error) {
    console.error("Delete profile error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
