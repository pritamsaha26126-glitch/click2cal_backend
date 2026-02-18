variable "project_name" {
  description = "Project name"
  type        = string
  default     = "Click2Cal"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment (dev/prod)"
  type        = string
  default     = "dev"
}



variable "aws_access_key" {
  description = "AWS Access Key"
  type        = string
  sensitive   = true  # Marks this as sensitive (won't show in output)
}

variable "aws_secret_key" {
  description = "AWS Secret Key"
  type        = string
  sensitive   = true  # Marks this as sensitive (won't show in output)
}