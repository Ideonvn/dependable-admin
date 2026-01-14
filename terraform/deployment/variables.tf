variable "aws_region" {
  description = "The AWS region to create all resources in"
  default     = "eu-west-1"
}

# Amplify variables
variable "repository_url" {
  description = "The GitHub repository URL for the admin app"
  type        = string
  # Example: "https://github.com/your-org/dependable-admin"
}

variable "github_access_token" {
  description = "GitHub personal access token for private repositories"
  type        = string
  sensitive   = true
  default     = ""
}

variable "nextauth_secret" {
  description = "Secret key for NextAuth.js session encryption"
  type        = string
  sensitive   = true
  # Generate with: openssl rand -base64 32
}

variable "google_client_id" {
  description = "Google OAuth Client ID"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth Client Secret"
  type        = string
  sensitive   = true
}

variable "app_domain" {
  description = "Custom domain for the admin app (leave empty to use Amplify default domain)"
  type        = string
  default     = ""
}
