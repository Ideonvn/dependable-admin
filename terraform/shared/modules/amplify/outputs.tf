output "amplify_app" {
  description = "The Amplify app details"
  value       = aws_amplify_app.admin_app
}

output "amplify_app_id" {
  description = "The unique ID of the Amplify app"
  value       = aws_amplify_app.admin_app.id
}

output "amplify_default_domain" {
  description = "The default domain for the Amplify app"
  value       = aws_amplify_app.admin_app.default_domain
}

output "amplify_app_url" {
  description = "The full URL of the deployed app"
  value       = var.app_domain != "" ? "https://${var.app_domain}" : "https://main.${aws_amplify_app.admin_app.default_domain}"
}

output "amplify_branch" {
  description = "The main branch details"
  value       = aws_amplify_branch.main
}

output "amplify_role_arn" {
  description = "The ARN of the IAM role used by Amplify"
  value       = aws_iam_role.amplify_role.arn
}

output "webhook_url" {
  description = "The webhook URL for manual deployments (if enabled)"
  value       = var.enable_webhook ? aws_amplify_webhook.main[0].url : null
  sensitive   = true
}

output "custom_domain" {
  description = "The custom domain association (if configured)"
  value       = var.app_domain != "" ? aws_amplify_domain_association.domain[0] : null
}
