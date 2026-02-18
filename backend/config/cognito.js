import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import dotenv from "dotenv";

dotenv.config();

export const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_AWS_REGION,
});

export const cognitoConfig = {
  region: process.env.COGNITO_AWS_REGION,
  userPoolId: process.env.COGNITO_USER_POOL_ID,
  clientId: process.env.COGNITO_CLIENT_ID,
};
