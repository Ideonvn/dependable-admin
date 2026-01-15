resource "aws_amplify_app" "admin_app" {
  name       = var.app_name
  repository = var.repository_url

  # Build settings for Next.js
  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - echo "AUTH_SECRET=$AUTH_SECRET" >> .env.production
            - echo "NEXTAUTH_URL=$NEXTAUTH_URL" >> .env.production
            - echo "GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" >> .env.production
            - echo "GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET" >> .env.production
            - echo "NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME" >> .env.production
            - npm ci --cache .npm --prefer-offline
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: .next
        files:
          - '**/*'
      cache:
        paths:
          - .next/cache/**/*
          - .npm/**/*
  EOT

  # Environment variables
  environment_variables = merge(
    {
      _LIVE_UPDATES = jsonencode([{
        pkg     = "next-version"
        type    = "npm"
        version = "latest"
      }])
    },
    var.environment_variables
  )

  # Enable auto branch creation for pull requests
  enable_auto_branch_creation = var.enable_auto_branch_creation
  enable_branch_auto_build    = var.enable_branch_auto_build

  # Access token for private repositories (optional)
  access_token = var.github_access_token != "" ? var.github_access_token : null

  # IAM service role for Amplify
  iam_service_role_arn = aws_iam_role.amplify_role.arn

  # Platform - Web for Next.js SSR
  platform = "WEB_COMPUTE"
}

# Main branch
resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.admin_app.id
  branch_name = var.main_branch_name

  enable_auto_build = true
  stage             = "PRODUCTION"

  environment_variables = var.branch_environment_variables
}

# Custom domain (optional)
resource "aws_amplify_domain_association" "domain" {
  count = var.app_domain != "" ? 1 : 0

  app_id      = aws_amplify_app.admin_app.id
  domain_name = "dependable.co.za"

  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = "admin"
  }
}

# IAM role for Amplify
resource "aws_iam_role" "amplify_role" {
  name = "${var.app_name}-amplify-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service: [
            "amplify.eu-west-1.amazonaws.com",
            "amplify.amazonaws.com"
          ]
        }
        Action = "sts:AssumeRole"
      },
      {
        Effect = "Allow"
        Principal = {
          Service = "amplifybackend.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# Attach basic Amplify execution policy
resource "aws_iam_role_policy_attachment" "amplify_backend_deployment" {
  role       = aws_iam_role.amplify_role.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess-Amplify"
}

# Additional managed policies for WEB_COMPUTE
resource "aws_iam_role_policy_attachment" "amplify_execution" {
  role       = aws_iam_role.amplify_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmplifyBackendDeployFullAccess"
}

# Additional policy for WEB_COMPUTE platform (Next.js SSR)
resource "aws_iam_role_policy" "amplify_compute_policy" {
  name = "${var.app_name}-compute-policy"
  role = aws_iam_role.amplify_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "amplify:*"
        ]
        Resource = "*"
      }
    ]
  })
}

# Custom policy for additional AWS service access (if needed)
resource "aws_iam_role_policy" "amplify_custom_policy" {
  count = length(var.additional_policy_statements) > 0 ? 1 : 0

  name = "${var.app_name}-custom-policy"
  role = aws_iam_role.amplify_role.id

  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = var.additional_policy_statements
  })
}

# Webhook for manual deployments (optional)
resource "aws_amplify_webhook" "main" {
  count = var.enable_webhook ? 1 : 0

  app_id      = aws_amplify_app.admin_app.id
  branch_name = aws_amplify_branch.main.branch_name
  description = "Webhook for manual deployments"
}
