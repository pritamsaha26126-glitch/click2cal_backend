import {
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GetUserCommand,
  GlobalSignOutCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { cognitoClient, cognitoConfig } from "../config/cognito.js";
import crypto from "crypto";

const hasClientSecret = !!process.env.COGNITO_CLIENT_SECRET;

export const getSecretHash = (username) => {
  if (!hasClientSecret) return undefined;

  const clientId = process.env.COGNITO_CLIENT_ID;
  const clientSecret = process.env.COGNITO_CLIENT_SECRET;

  if (!clientSecret) {
    throw new Error("COGNITO_CLIENT_SECRET is required for this operation");
  }

  return crypto
    .createHmac("SHA256", clientSecret)
    .update(username + clientId)
    .digest("base64");
};

export const signUpUser = async (email, password, userAttributes = []) => {
  const command = new SignUpCommand({
    ClientId: cognitoConfig.clientId,
    Username: email,
    Password: password,
    UserAttributes: userAttributes,
    ...(hasClientSecret && { SecretHash: getSecretHash(email) }),
  });

  try {
    const response = await cognitoClient.send(command);
    return {
      success: true,
      data: {
        userId: response.UserSub,
        userConfirmed: response.UserConfirmed,
      },
    };
  } catch (error) {
    console.error("Sign up error:", error);
    return {
      success: false,
      error: error.message,
      code: error.name,
    };
  }
};

export const confirmUserOTP = async (email, code) => {
  const command = new ConfirmSignUpCommand({
    ClientId: cognitoConfig.clientId,
    Username: email,
    ConfirmationCode: code,
    ...(hasClientSecret && { SecretHash: getSecretHash(email) }),
  });

  try {
    await cognitoClient.send(command);
    return {
      success: true,
      message: "Email verified successfully",
    };
  } catch (error) {
    console.error("Confirm OTP error:", error);
    return {
      success: false,
      error: error.message,
      code: error.name,
    };
  }
};

export const loginUser = async (email, password) => {
  const authParameters = {
    USERNAME: email,
    PASSWORD: password,
  };

  if (hasClientSecret) {
    authParameters.SECRET_HASH = getSecretHash(email);
  }

  const command = new InitiateAuthCommand({
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: cognitoConfig.clientId,
    AuthParameters: authParameters,
  });

  try {
    const response = await cognitoClient.send(command);

    const authenticationResult = response.AuthenticationResult;

    if (!authenticationResult) {
      throw new Error("Authentication failed - no tokens received");
    }

    return {
      success: true,
      data: {
        accessToken: authenticationResult.AccessToken,
        idToken: authenticationResult.IdToken,
        refreshToken: authenticationResult.RefreshToken,
        expiresIn: authenticationResult.ExpiresIn,
        tokenType: authenticationResult.TokenType,
      },
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      success: false,
      error: error.message,
      code: error.name,
    };
  }
};

export const forgotPassword = async (email) => {
  const command = new ForgotPasswordCommand({
    ClientId: cognitoConfig.clientId,
    Username: email,
    ...(hasClientSecret && { SecretHash: getSecretHash(email) }),
  });

  try {
    await cognitoClient.send(command);
    return {
      success: true,
      message: "Password reset code sent to email",
    };
  } catch (error) {
    console.error("Forgot password error:", error);
    return {
      success: false,
      error: error.message,
      code: error.name,
    };
  }
};

export const confirmForgotPassword = async (email, code, newPassword) => {
  const command = new ConfirmForgotPasswordCommand({
    ClientId: cognitoConfig.clientId,
    Username: email,
    ConfirmationCode: code,
    Password: newPassword,
    ...(hasClientSecret && { SecretHash: getSecretHash(email) }),
  });

  try {
    await cognitoClient.send(command);
    return {
      success: true,
      message: "Password reset successful",
    };
  } catch (error) {
    console.error("Confirm forgot password error:", error);
    return {
      success: false,
      error: error.message,
      code: error.name,
    };
  }
};

export const getUserInfo = async (accessToken) => {
  const command = new GetUserCommand({
    AccessToken: accessToken,
  });

  try {
    const response = await cognitoClient.send(command);
    return {
      success: true,
      data: {
        username: response.Username,
        attributes: response.UserAttributes.reduce((acc, attr) => {
          acc[attr.Name] = attr.Value;
          return acc;
        }, {}),
      },
    };
  } catch (error) {
    console.error("Get user info error:", error);
    return {
      success: false,
      error: error.message,
      code: error.name,
    };
  }
};

export const logoutUser = async (accessToken) => {
  const command = new GlobalSignOutCommand({
    AccessToken: accessToken,
  });

  try {
    await cognitoClient.send(command);
    return {
      success: true,
      message: "Logged out successfully",
    };
  } catch (error) {
    console.error("Logout error:", error);
    return {
      success: false,
      error: error.message,
      code: error.name,
    };
  }
};

export const resendConfirmationCode = async (email) => {
  const { ResendConfirmationCodeCommand } =
    await import("@aws-sdk/client-cognito-identity-provider");

  const command = new ResendConfirmationCodeCommand({
    ClientId: cognitoConfig.clientId,
    Username: email,
    ...(hasClientSecret && { SecretHash: getSecretHash(email) }),
  });

  try {
    await cognitoClient.send(command);
    return {
      success: true,
      message: "Confirmation code resent successfully",
    };
  } catch (error) {
    console.error("Resend confirmation code error:", error);
    return {
      success: false,
      error: error.message,
      code: error.name,
    };
  }
};
export const deleteCognitoUser = async (email) => {
  try {
    console.log(`Attempting to delete user ${email} from Cognito...`);

    const command = new AdminDeleteUserCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID,
      Username: email,
    });

    await cognitoClient.send(command);

    console.log(`User ${email} successfully deleted from Cognito`);
    return {
      success: true,
      message: "User deleted from Cognito successfully",
    };
  } catch (error) {
    console.error(" Error deleting user from Cognito:", error);

    if (error.name === "UserNotFoundException") {
      return {
        success: false,
        error: "User not found in Cognito",
        code: "USER_NOT_FOUND",
      };
    }

    if (error.name === "NotAuthorizedException") {
      return {
        success: false,
        error: "Not authorized to delete user. Check IAM permissions.",
        code: "NOT_AUTHORIZED",
      };
    }

    if (error.name === "InvalidParameterException") {
      return {
        success: false,
        error: "Invalid parameter. Check UserPoolId and email format.",
        code: "INVALID_PARAMETER",
      };
    }

    return {
      success: false,
      error: error.message,
      code: error.name || "COGNITO_ERROR",
    };
  }
};
