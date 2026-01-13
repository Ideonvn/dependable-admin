variable "app_name" {
  description = "The name of the Amplify application"
  type        = string
  default     = "dependable-admin"
}

variable "repository_url" {
  description = "The repository URL (GitHub, GitLab, Bitbucket, or AWS CodeCommit)"
  type        = string
}

variable "github_access_token" {
  description = "GitHub personal access token for private repositories"
  type        = string
  default     = ""
  sensitive   = true
}

variable "main_branch_name" {
  description = "The main branch name to deploy"
  type        = string
  default     = "main"
}

variable "app_domain" {
  description = "Custom domain for the app (leave empty to use Amplify default domain)"
  type        = string
  default     = ""
}

variable "environment_variables" {
  description = "Environment variables for the Amplify app"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "branch_environment_variables" {
  description = "Environment variables specific to the main branch"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "enable_auto_branch_creation" {
  description = "Enable automatic branch creation for pull requests"
  type        = bool
  default     = true
}

variable "enable_branch_auto_build" {
  description = "Enable automatic builds for branches"
  type        = bool
  default     = true
}

variable "enable_webhook" {
  description = "Enable webhook for manual deployments"
  type        = bool
  default     = false
}

variable "additional_policy_statements" {
  description = "Additional IAM policy statements for Amplify role"
  type        = list(any)
  default     = []
}

variable "aws_region" {
  description = "The AWS region to create all resources in"
  type        = string
  default     = "af-south-1"
}
