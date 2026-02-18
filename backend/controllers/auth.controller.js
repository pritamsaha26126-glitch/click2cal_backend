import {
  signUpUser,
  confirmUserOTP,
  loginUser,
  forgotPassword,
  confirmForgotPassword,
  getUserInfo,
  logoutUser,
  resendConfirmationCode,
} from "../services/auth.service.js";

export const signupController = async (req, res) => {
  try {
    console.log("Signup request body:", req.body);

    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: "Request body is empty",
      });
    }

    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    const userAttributes = [];
    if (name) {
      userAttributes.push({
        Name: "name",
        Value: name,
      });
    }

    userAttributes.push({
      Name: "email",
      Value: email,
    });

    const result = await signUpUser(email, password, userAttributes);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json({
      success: true,
      message:
        "User registered successfully. Please check your email for verification code.",
      data: result.data,
    });
  } catch (error) {
    console.error("Signup controller error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export const confirmOTPController = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: "Email and code are required",
      });
    }

    const result = await confirmUserOTP(email, code);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Confirm OTP controller error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    const result = await loginUser(email, password);

    if (!result.success) {
      let statusCode = 400;

      if (result.code === "NotAuthorizedException") {
        statusCode = 401;
      } else if (result.code === "UserNotFoundException") {
        statusCode = 404;
      } else if (result.code === "UserNotConfirmedException") {
        statusCode = 403;
      }

      return res.status(statusCode).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Login controller error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export const forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const result = await forgotPassword(email);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Forgot password controller error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export const confirmForgotPasswordController = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Email, code, and new password are required",
      });
    }

    const result = await confirmForgotPassword(email, code, newPassword);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Confirm forgot password controller error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export const getCurrentUserController = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(" ")[1];

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: "Access token required",
      });
    }

    const result = await getUserInfo(accessToken);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Get user info controller error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export const logoutController = async (req, res) => {
  try {
    const accessToken = req.headers.authorization?.split(" ")[1];

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: "Access token required",
      });
    }

    const result = await logoutUser(accessToken);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Logout controller error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

export const resendConfirmationController = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const result = await resendConfirmationCode(email);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Resend confirmation controller error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};
