locals {
  # Create lowercase domain prefix
  domain_prefix = lower("${var.project_name}-${var.environment}")
}

# Cognito User Pool
resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-${var.environment}"

  # Allow sign-in with email
  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # Password policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  # MFA - OPTIONAL (user can enable TOTP)
  mfa_configuration = "OPTIONAL"

  software_token_mfa_configuration {
    enabled = true
  }

  # Email verification
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Macro Tracker - Verify your email"
    email_message        = "Your verification code is {####}"
  }

  # Schema - required attributes
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = false
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = false
    mutable             = true
  }

  # Account recovery
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Lambda triggers (optional - for custom flows)
  # lambda_config {
  #   pre_sign_up = aws_lambda_function.pre_signup.arn
  # }

  tags = {
    Name        = "${var.project_name}-user-pool"
    Environment = var.environment
  }
}

# App Client (for your mobile/web app)
resource "aws_cognito_user_pool_client" "app" {
  name         = "${var.project_name}-app-client"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret = false # Mobile apps don't need secret

  # Authentication flows
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",   # Email + Password
    "ALLOW_REFRESH_TOKEN_AUTH",   # Refresh tokens
    "ALLOW_USER_SRP_AUTH"         # Secure Remote Password
  ]

  # Token validity
  refresh_token_validity = 30 # days
  access_token_validity  = 1  # hour
  id_token_validity      = 1  # hour

  token_validity_units {
    refresh_token = "days"
    access_token  = "hours"
    id_token      = "hours"
  }

  # Prevent user enumeration attacks
  prevent_user_existence_errors = "ENABLED"

  # Allowed OAuth flows (if needed later)
  allowed_oauth_flows_user_pool_client = false

  # Read/Write permissions
  read_attributes = [
    "email",
    "email_verified",
    "name"
  ]

  write_attributes = [
    "email",
    "name"
  ]
}

# Random string for domain suffix
resource "random_string" "domain_suffix" {
  length  = 8
  special = false
  upper   = false
}

# User Pool Domain (for hosted UI - optional)
resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${local.domain_prefix}-${random_string.domain_suffix.result}"
  user_pool_id = aws_cognito_user_pool.main.id
}