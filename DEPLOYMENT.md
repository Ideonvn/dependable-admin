# AWS Amplify Deployment Guide

This guide walks you through deploying the Dependable Admin application to AWS Amplify using Terraform.

## 📋 Prerequisites Checklist

- [ ] AWS account with appropriate permissions
- [ ] AWS CLI configured (`aws configure`)
- [ ] Terraform installed (v1.0+)
- [ ] GitHub repository created for your app
- [ ] Google OAuth credentials obtained
- [ ] Code pushed to GitHub

## 🚀 Quick Start

### Step 1: Set Up Secrets

1. **Generate NextAuth Secret**:
   ```bash
   openssl rand -base64 32
   ```
   Copy the output - you'll need it in Step 3.

2. **Get Google OAuth Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create OAuth 2.0 Client ID (if not done)
   - Note: You'll update redirect URIs after first deployment

3. **Create terraform.tfvars**:
   ```bash
   cd terraform/deployment
   cp terraform.tfvars.example terraform.tfvars
   ```

4. **Edit terraform.tfvars** with your values:
   ```hcl
   aws_region = "af-south-1"
   
   repository_url = "https://github.com/your-org/dependable-admin"
   github_access_token = "ghp_xxxx"  # If private repo
   
   nextauth_secret = "your-generated-secret-from-step-1"
   google_client_id = "xxxx.apps.googleusercontent.com"
   google_client_secret = "xxxx"
   ```

### Step 2: Initialize Terraform

```bash
cd terraform/deployment
make setup
```

Or manually:
```bash
terraform init
```

### Step 3: Review Deployment Plan

```bash
make prepare
```

Or manually:
```bash
terraform validate
terraform plan
```

Review the resources that will be created:
- AWS Amplify App
- Amplify Branch (main)
- IAM Role and Policies
- (Optional) Custom Domain

### Step 4: Deploy

```bash
make provision
```

Or manually:
```bash
terraform apply
```

Type `yes` when prompted.

**Deployment takes 5-10 minutes** for the first build.

### Step 5: Get Your App URL

```bash
make output
```

You'll see output like:
```
dependable-admin-app = {
  app_url = "https://main.d1a2b3c4d5e6f7.amplifyapp.com"
  app_id = "d1a2b3c4d5e6f7"
  domain = "d1a2b3c4d5e6f7.amplifyapp.com"
}
```

### Step 6: Update Google OAuth Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your OAuth 2.0 Client ID
3. Add these **Authorized redirect URIs**:
   ```
   https://main.d1a2b3c4d5e6f7.amplifyapp.com/api/auth/callback/google
   https://main.d1a2b3c4d5e6f7.amplifyapp.com
   ```
   (Replace with your actual Amplify URL from Step 5)

4. Save changes

### Step 7: Test Your Deployment

1. Open your app URL
2. Click "Sign in with Google"
3. Verify authentication works
4. Check that all pages load correctly

## 🔄 Making Updates

### Code Changes

Simply push to your `main` branch:
```bash
git add .
git commit -m "Update feature"
git push origin main
```

Amplify will automatically:
1. Detect the push
2. Build your app
3. Deploy updates (usually 3-5 minutes)

### Infrastructure Changes

Update Terraform files and run:
```bash
make prepare  # Review changes
make provision  # Apply changes
```

## 🌐 Custom Domain Setup (Optional)

### 1. Prerequisites
- Domain registered in Route53 (or external with DNS pointing to Route53)
- Route53 hosted zone configured

### 2. Update Configuration

In `terraform/deployment/main.tf`, uncomment and set:
```hcl
module "dependable-admin-app" {
  # ... existing config ...
  
  app_domain = "admin.dependable.co.za"
}
```

### 3. Apply Changes

```bash
make provision
```

### 4. Verify Domain

1. Go to AWS Amplify Console
2. Navigate to your app > Domain management
3. Wait for SSL certificate validation (can take 24-48 hours)
4. Verify DNS records in Route53

### 5. Update Google OAuth

Add your custom domain to redirect URIs:
```
https://admin.dependable.co.za/api/auth/callback/google
https://admin.dependable.co.za
```

## 📊 Monitoring & Logs

### View Build Logs

**Option 1 - AWS Console**:
1. Go to [AWS Amplify Console](https://console.aws.amazon.com/amplify/)
2. Select your app
3. Click on "main" branch
4. View build history

**Option 2 - AWS CLI**:
```bash
APP_ID=$(terraform output -raw dependable-admin-app | jq -r '.app_id')
aws amplify list-jobs --app-id $APP_ID --branch-name main
```

### View Runtime Logs

Logs are automatically sent to CloudWatch:
```bash
aws logs tail /aws/amplify/dependable-admin --follow
```

### Check App Status

```bash
aws amplify get-app --app-id $(terraform output -raw dependable-admin-app | jq -r '.app_id')
```

## 🐛 Troubleshooting

### Build Failures

**Symptom**: Builds fail with npm errors

**Solution**:
1. Check build logs in Amplify console
2. Verify `package.json` scripts are correct
3. Check for Node version compatibility
4. Increase build timeout in Amplify settings if needed

### Authentication Not Working

**Symptom**: "Configuration error" or redirect issues

**Solutions**:
1. Verify `NEXTAUTH_URL` environment variable is set correctly
2. Check Google OAuth redirect URIs include exact Amplify URL
3. Verify `NEXTAUTH_SECRET` is set
4. Check `.env.local.example` for required variables

**Verify env vars in Terraform**:
```bash
terraform output
```

### Domain Not Resolving

**Symptom**: Custom domain not working

**Solutions**:
1. Check Route53 DNS records
2. Verify SSL certificate status in Amplify console
3. Wait 24-48 hours for DNS propagation
4. Check domain verification status

### Slow Build Times

**Symptom**: Builds taking >10 minutes

**Solutions**:
1. Enable caching (already configured in module)
2. Optimize dependencies in `package.json`
3. Remove unnecessary build steps
4. Consider using `.nvmrc` to lock Node version

## 💰 Cost Monitoring

### Check Current Costs

```bash
aws ce get-cost-and-usage \
  --time-period Start=2025-01-01,End=2025-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://cost-filter.json
```

### Set Up Budget Alert

Create `cost-filter.json`:
```json
{
  "Tags": {
    "Key": "Project",
    "Values": ["Dependable"]
  }
}
```

Then:
```bash
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json
```

## 🔐 Security Best Practices

### 1. Rotate Secrets Regularly

Update secrets in `terraform.tfvars`:
```bash
# Generate new NextAuth secret
openssl rand -base64 32

# Update Google OAuth credentials if compromised
```

Then apply:
```bash
make provision
```

### 2. Review IAM Permissions

The Amplify role has minimum required permissions. Review:
```bash
terraform state show module.dependable-admin-app.aws_iam_role.amplify_role
```

### 3. Enable MFA on AWS Account

Ensure all AWS users have MFA enabled.

### 4. Monitor Access Logs

Set up CloudWatch alarms for unusual access patterns.

## 🗑️ Cleanup

### Temporary Removal (Keep State)

```bash
terraform destroy
```

This removes AWS resources but keeps Terraform state.

### Complete Removal

```bash
cd terraform/deployment
terraform destroy
rm -rf .terraform terraform.tfstate*
```

⚠️ **Warning**: This is permanent and cannot be undone!

## 📞 Support

### Common Commands Reference

```bash
# Deployment
make setup       # Initialize Terraform
make prepare     # Validate and plan
make provision   # Deploy/update
make destroy     # Remove all resources
make output      # Show outputs

# Monitoring
make format      # Format Terraform files
make refresh     # Sync state with AWS

# AWS CLI
aws amplify list-apps
aws amplify get-app --app-id <APP_ID>
aws amplify list-branches --app-id <APP_ID>
```

### Getting Help

1. **Check logs**: AWS Amplify Console > Build history
2. **Review state**: `terraform show`
3. **Verify resources**: AWS Console > Amplify
4. **Check variables**: `terraform output`

### Useful Links

- [AWS Amplify Documentation](https://docs.aws.amazon.com/amplify/)
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)

## ✅ Post-Deployment Checklist

- [ ] Application accessible via URL
- [ ] Google authentication working
- [ ] All pages loading correctly
- [ ] Dark mode toggle working
- [ ] Mock data displaying
- [ ] Build logs clean (no errors)
- [ ] Custom domain configured (if applicable)
- [ ] CloudWatch logging enabled
- [ ] Cost monitoring set up
- [ ] Team members have access
- [ ] Documentation updated with live URL

---

**Need help?** Check the main README or AWS Amplify documentation.
