# Dependable Admin - AWS Amplify Infrastructure

This directory contains Terraform configuration for deploying the Dependable Admin Next.js application to AWS Amplify.

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Terraform** v1.0+ installed
3. **GitHub repository** with your admin app code
4. **GitHub Personal Access Token** (for private repos)
5. **Google OAuth credentials** (Client ID & Secret)

## Environment Variables

Create a `terraform.tfvars` file in the `deployment/` directory:

```hcl
# AWS Configuration
aws_region = "af-south-1"

# Repository
repository_url = "https://github.com/your-org/dependable-admin"
github_access_token = "ghp_xxxxxxxxxxxxxxxxxxxx"  # Optional for public repos

# NextAuth Configuration
nextauth_secret = "your-generated-secret-key"  # Generate with: openssl rand -base64 32
google_client_id = "your-google-client-id.apps.googleusercontent.com"
google_client_secret = "your-google-client-secret"

# Optional: Custom Domain
# app_domain = "admin.dependable.co.za"
```

**Important:** Add `terraform.tfvars` to `.gitignore` to keep secrets safe!

## Deployment Steps

### 1. Initialize Terraform

```bash
cd terraform/deployment
terraform init
```

### 2. Review the Plan

```bash
terraform plan
```

### 3. Apply Configuration

```bash
terraform apply
```

Or use the Makefile:

```bash
make apply
```

### 4. Get Outputs

After successful deployment:

```bash
terraform output
```

You'll see:
- **app_url**: Your live application URL
- **app_id**: Amplify App ID
- **domain**: Default Amplify domain

## Project Structure

```
terraform/
├── deployment/           # Main deployment configuration
│   ├── main.tf          # Module instantiation
│   ├── providers.tf     # AWS provider config
│   ├── variables.tf     # Input variables
│   ├── terraform.tfvars # Secret values (gitignored)
│   └── Makefile         # Deployment shortcuts
└── shared/
    └── modules/
        └── amplify/     # Reusable Amplify module
            ├── main.tf
            ├── variables.tf
            └── outputs.tf
```

## Module Configuration

The Amplify module includes:

- **Next.js SSR Support** - WEB_COMPUTE platform for server-side rendering
- **Build Configuration** - Optimized for Next.js builds
- **Environment Variables** - NextAuth, Google OAuth, etc.
- **Auto Branch Creation** - PR preview deployments
- **Custom Domain** - Optional Route53 integration
- **IAM Roles** - Proper permissions for Amplify
- **S3 Access** - Integration with existing S3 bucket

## Custom Domain Setup (Optional)

1. **Configure Route53 hosted zone** for your domain
2. **Update variables**:
   ```hcl
   app_domain = "admin.dependable.co.za"
   ```
3. **Apply changes**: `terraform apply`
4. **Verify domain** in AWS Amplify console (AWS will create SSL cert)

## Environment Variables

The following environment variables are automatically configured:

- `NEXTAUTH_URL` - App URL for NextAuth
- `NEXTAUTH_SECRET` - Session encryption key
- `GOOGLE_CLIENT_ID` - Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth Client Secret
- `NEXT_PUBLIC_APP_NAME` - Application name
- `NODE_ENV` - Set to "production"

## Updating the App

Changes pushed to your `main` branch will automatically:
1. Trigger a new build in Amplify
2. Run tests (if configured)
3. Deploy to production

## Manual Deployment

Enable webhook in `main.tf`:

```hcl
enable_webhook = true
```

Then use:

```bash
curl -X POST "$(terraform output -raw webhook_url)"
```

## Monitoring

View build logs and metrics in:
- **AWS Amplify Console**: https://console.aws.amazon.com/amplify/
- **CloudWatch Logs**: Automatic logging enabled

## Costs

Expected monthly costs:
- **Builds**: ~$1-2/month (50 builds)
- **Hosting**: $0-5/month (within free tier for low traffic)
- **Compute**: $5-10/month (SSR serverless compute)

**Total**: ~$5-15/month for small team usage

## Troubleshooting

### Build Failures

Check build logs in Amplify console. Common issues:
- Missing environment variables
- Node version mismatch
- Build timeout (increase in console)

### Authentication Issues

Verify:
1. `NEXTAUTH_URL` matches deployed URL
2. Google OAuth redirect URIs include Amplify URL
3. `NEXTAUTH_SECRET` is set correctly

### Domain Not Working

1. Check Route53 DNS records
2. Verify SSL certificate status in Amplify
3. Wait 24-48 hours for DNS propagation

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

Or:

```bash
make destroy
```

## Security Notes

- All secrets are marked `sensitive = true`
- IAM role follows least-privilege principle
- SSL/TLS enabled by default
- Environment variables encrypted at rest
- Access logs retained for 30 days

## Support

For issues:
1. Check AWS Amplify console logs
2. Review CloudWatch logs
3. Check Terraform state: `terraform show`
