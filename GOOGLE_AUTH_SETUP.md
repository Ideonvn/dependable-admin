# Google OAuth Setup Guide

This guide will help you set up Google Sign-In for the Dependable Admin interface.

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a Project" → "New Project"
3. Enter project name: "Dependable Admin" (or your preferred name)
4. Click "Create"

## Step 2: Enable Google+ API

1. In your project, go to "APIs & Services" → "Library"
2. Search for "Google+ API"
3. Click on it and press "Enable"

## Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select **"Internal"** (if using Google Workspace) or **"External"**
3. Fill in the required fields:
   - **App name**: Dependable Admin
   - **User support email**: Your email
   - **Developer contact email**: Your email
4. Click "Save and Continue"
5. On "Scopes" page, click "Save and Continue" (default scopes are fine)
6. On "Test users" page (for External apps):
   - Add email addresses of users who should have access
   - Click "Save and Continue"
7. Review and click "Back to Dashboard"

## Step 4: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Select "Web application"
4. Configure:
   - **Name**: Dependable Admin Web Client
   - **Authorized JavaScript origins**:
     - `http://localhost:3000`
     - `https://yourdomain.com` (for production)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://yourdomain.com/api/auth/callback/google` (for production)
5. Click "Create"
6. Copy the **Client ID** and **Client Secret**

## Step 5: Update Environment Variables

Update your `.env.local` file:

```env
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here

# Generate a secure secret for NextAuth
AUTH_SECRET=run-openssl-rand-base64-32-to-generate

# Your app URL
NEXTAUTH_URL=http://localhost:3000
```

### Generate AUTH_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

Copy the output and paste it as your `AUTH_SECRET`.

## Step 6: Restart Development Server

```bash
# Stop the current server (Ctrl+C)
npm run dev
```

## Step 7: Test Authentication

1. Go to http://localhost:3000
2. You should be redirected to the sign-in page
3. Click "Sign in with Google"
4. Choose your Google account
5. Grant permissions
6. You should be redirected back to the admin dashboard

## Restricting Access (Recommended)

To restrict access to specific users, you have several options:

### Option 1: Internal Apps (Google Workspace Only)

If you selected "Internal" in Step 3, only users in your Google Workspace organization can sign in.

### Option 2: Test Users (External Apps)

For "External" apps in testing mode, only users added to the "Test users" list can sign in.

### Option 3: Email Whitelist in Code

Update `auth.ts` to check allowed emails:

```typescript
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Whitelist specific emails
      const allowedEmails = [
        'admin@yourdomain.com',
        'user@yourdomain.com',
      ];
      
      if (user.email && allowedEmails.includes(user.email)) {
        return true;
      }
      
      return false; // Access denied
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith('/')
      
      if (isOnDashboard) {
        if (isLoggedIn) return true
        return false
      } else if (isLoggedIn) {
        return Response.redirect(new URL('/', nextUrl))
      }
      return true
    },
  },
})
```

### Option 4: Domain Restriction

Allow anyone from your domain:

```typescript
async signIn({ user, account, profile }) {
  const allowedDomain = 'yourdomain.com';
  
  if (user.email && user.email.endsWith(`@${allowedDomain}`)) {
    return true;
  }
  
  return false; // Access denied
}
```

## Production Deployment

When deploying to production:

1. Update Google OAuth settings with production URLs
2. Add production redirect URI: `https://yourdomain.com/api/auth/callback/google`
3. Update environment variables on your hosting platform
4. Set `NEXTAUTH_URL=https://yourdomain.com`
5. Generate a new `AUTH_SECRET` for production

## Troubleshooting

### "Error 400: redirect_uri_mismatch"

- Check that your redirect URI in Google Console exactly matches: `http://localhost:3000/api/auth/callback/google`
- No trailing slash
- Correct protocol (http vs https)

### "Access Denied"

- For External apps, make sure your email is added to Test Users
- Check if you've implemented email whitelist correctly

### "Error: NEXTAUTH_URL is not set"

- Make sure `.env.local` contains `NEXTAUTH_URL=http://localhost:3000`
- Restart your dev server after adding environment variables

### Session Issues

- Clear browser cookies and try again
- Check that `AUTH_SECRET` is set and is a long random string

## Security Best Practices

1. **Never commit** `.env.local` to git (already in `.gitignore`)
2. Use different credentials for development and production
3. Regularly rotate `AUTH_SECRET` in production
4. Implement proper access control (email whitelist or domain restriction)
5. Enable 2FA for Google accounts with admin access

## Next Steps

Once authentication is working:

- [ ] Add role-based access control if needed
- [ ] Implement session management
- [ ] Add audit logging for sensitive operations
- [ ] Set up production OAuth credentials
- [ ] Configure session timeout settings
