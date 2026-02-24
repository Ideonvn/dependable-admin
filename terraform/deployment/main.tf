module "dependable-admin-app" {
  source         = "../shared/modules/amplify"
  app_name       = "dependable-admin"
  repository_url = var.repository_url

  # GitHub access token for private repo (stored in AWS Secrets Manager or env var)
  github_access_token = var.github_access_token

  # Main branch to deploy
  main_branch_name = "main"

  # Optional: Custom domain (configure in Route53 first)
  app_domain = var.app_domain

  # Environment variables for NextAuth and app
  environment_variables = {
    NEXT_PUBLIC_API_URL  = "https://api.dependable.co.za"
    NEXTAUTH_URL         = "https://${var.app_domain}"
    AUTH_SECRET          = var.nextauth_secret
    GOOGLE_CLIENT_ID     = var.google_client_id
    GOOGLE_CLIENT_SECRET = var.google_client_secret
    SENTRY_AUTH_TOKEN    = var.sentry_auth_token
    NEXT_PUBLIC_APP_NAME = "Dependable Admin"
    NODE_ENV             = "production"
  }

  # Enable PR preview deployments
  enable_auto_branch_creation = true
  enable_branch_auto_build    = true
}

output "dependable-admin-app" {
  value = {
    app_id        = module.dependable-admin-app.amplify_app_id
    app_url       = module.dependable-admin-app.amplify_app_url
    domain        = module.dependable-admin-app.amplify_default_domain
    custom_domain = module.dependable-admin-app.custom_domain
  }
}
