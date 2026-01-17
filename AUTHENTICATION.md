# Authentication Added ✅

Google Sign-In has been successfully added to the Dependable Admin interface!

## What Was Added

### 🔐 Authentication System
- **NextAuth.js v5** (Auth.js) integration
- **Google OAuth** provider configured
- **Protected routes** via middleware
- **Session management** with server-side rendering
- **Sign-in page** with Google button
- **User menu** with profile info and sign-out

### 📁 New Files Created

1. **src/lib/auth.ts** - NextAuth configuration
2. **src/middleware.ts** - Route protection middleware
3. **src/app/api/auth/[...nextauth]/route.ts** - Auth API endpoints
4. **src/app/auth/signin/page.tsx** - Custom sign-in page
5. **src/components/UserMenu.tsx** - User profile dropdown
6. **src/components/DashboardClient.tsx** - Client-side dashboard logic
7. **GOOGLE_AUTH_SETUP.md** - Complete setup guide

### 🔄 Modified Files

- **src/app/page.tsx** - Now uses server components with auth check
- **.env.local** - Added auth environment variables
- **tsconfig.json** - Updated paths configuration

## 🚀 Quick Setup

### 1. Set Up Google OAuth

Follow the detailed guide in [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md):

1. Create a Google Cloud project
2. Enable Google+ API
3. Configure OAuth consent screen
4. Create OAuth credentials
5. Get Client ID and Client Secret

### 2. Update Environment Variables

Edit `.env.local`:

```env
# Generate a secure secret
AUTH_SECRET=run-openssl-rand-base64-32

# Your app URL
NEXTAUTH_URL=http://localhost:3000

# From Google Cloud Console
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret-here
```

### 3. Generate AUTH_SECRET

```bash
openssl rand -base64 32
```

### 4. Restart the Dev Server

```bash
npm run dev
```

## 🎯 How It Works

1. **User visits the app** → Middleware checks authentication
2. **Not authenticated** → Redirected to `/auth/signin`
3. **Clicks "Sign in with Google"** → OAuth flow begins
4. **Authenticates with Google** → User info stored in session
5. **Redirected to dashboard** → Full access to admin interface
6. **Session persists** → Stays logged in across page refreshes

## 🔒 Security Features

- ✅ Server-side session validation
- ✅ Protected API routes
- ✅ Secure cookie-based sessions
- ✅ CSRF protection built-in
- ✅ OAuth 2.0 standard compliance

## 🎨 User Experience

### Before Login
- Clean sign-in page with Google button
- No access to admin features

### After Login
- Header shows user name, email, and profile picture
- Sign-out button in the header
- Full access to all admin features

## 📝 Restricting Access

By default, any Google account can sign in. To restrict access:

### Option 1: Email Whitelist

Edit `src/lib/auth.ts` and add:

```typescript
callbacks: {
  async signIn({ user }) {
    const allowedEmails = [
      'admin@yourdomain.com',
      'user@yourdomain.com',
    ];
    return user.email ? allowedEmails.includes(user.email) : false;
  },
  // ... existing authorized callback
}
```

### Option 2: Domain Restriction

```typescript
async signIn({ user }) {
  const allowedDomain = 'yourdomain.com';
  return user.email?.endsWith(`@${allowedDomain}`) ?? false;
}
```

### Option 3: Google Workspace Internal

When setting up OAuth consent screen, choose "Internal" to restrict to your organization only.

## 🐛 Troubleshooting

### "redirect_uri_mismatch" Error
- Check that authorized redirect URI is: `http://localhost:3000/api/auth/callback/google`
- No trailing slash, exact match required

### Can't Sign In
- Make sure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set correctly
- Check that `.env.local` is in the project root
- Restart dev server after changing environment variables

### "Error: NEXTAUTH_URL is not set"
- Add `NEXTAUTH_URL=http://localhost:3000` to `.env.local`
- Restart the dev server

### Session Issues
- Clear browser cookies
- Check that `AUTH_SECRET` is set and is a random string (at least 32 characters)

## 📚 Resources

- [NextAuth.js Documentation](https://authjs.dev/)
- [Google OAuth Setup Guide](GOOGLE_AUTH_SETUP.md)
- [Google Cloud Console](https://console.cloud.google.com/)

## ✨ Next Steps

- [ ] Set up Google OAuth credentials
- [ ] Generate and add `AUTH_SECRET`
- [ ] Test sign-in flow
- [ ] Add email whitelist or domain restriction
- [ ] Configure for production deployment

---

# 🔄 Backend Token Management (NEW)

## Overview

The authentication system now includes **automatic backend token management**. When users sign in with Google, the system exchanges the Google ID token for your backend API token and manages token refresh automatically.

## How It Works

### Token Exchange Flow

1. **User signs in with Google** → NextAuth receives Google ID token
2. **AuthInitializer detects session** → Automatically calls your backend
3. **Backend token exchange** → `POST /auth/google?token=<google_id_token>`
4. **Token stored** → Backend `access_token` saved in localStorage
5. **API requests** → All requests automatically include `Authorization: Bearer <token>`
6. **Auto-refresh** → Expired tokens refreshed automatically before requests

### New Components

#### `src/lib/tokenService.ts`
Token management service that:
- Stores backend tokens in localStorage
- Checks token expiry (with 1-minute buffer)
- Exchanges Google ID token for backend token
- Auto-refreshes expired tokens

#### `src/components/AuthInitializer.tsx`
Client component that:
- Wraps your app in root layout
- Syncs NextAuth session with backend tokens
- Triggers initial token exchange on login
- Clears tokens on logout

#### Updated: `src/lib/api.ts`
API client now:
- Uses dynamic tokens instead of hardcoded token
- Has async request interceptor
- Auto-refreshes tokens before each request
- Adds `Authorization: Bearer <token>` to all requests

#### Updated: `src/lib/auth.ts`
NextAuth config enhanced with:
- JWT callback that stores Google ID token
- Session callback that passes token to client
- `access_type: "offline"` for token refresh

### Backend API Endpoint Required

Your backend must implement:

**POST** `/auth/google?token=<google_id_token>`

**Expected Response:**
```json
{
  "user_id": "7f3c2a1e-9d4e-4c6b-b2c4-3a1e5f9c8d21",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "issued_at": "2026-01-17T18:30:00Z",
  "expires_at": "2026-01-17T19:30:00Z",
  "refresh_token": "d2b7c2a1-5c3e-4a92-9f10-8f6d5c3b2a1e"
}
```

### Environment Variables

Add to `.env.local`:

```env
# Backend API Base URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Usage

All API calls now automatically include the backend token:

```typescript
import { schoolsApi } from '@/lib/schools';

// Token automatically added - no manual handling needed!
const schools = await schoolsApi.getAllSchools();
const records = await schoolsApi.getRecords(schoolId);
```

## Token Storage

Tokens are stored in `localStorage` with key `backend_token_data`:

```json
{
  "access_token": "eyJhbGci...",
  "expires_at": "2026-01-17T19:30:00Z",
  "refresh_token": "d2b7c2a1-...",
  "user_id": "7f3c2a1e-..."
}
```

## Testing the Integration

1. **Sign in with Google**
   - Check browser console for: `"Backend token initialized successfully"`
   - Check localStorage for `backend_token_data`

2. **Make API requests**
   - Open Network tab in DevTools
   - Look for `Authorization: Bearer <token>` header in requests
   - Verify requests return 200 status

3. **Test token refresh**
   - Edit `expires_at` in localStorage to a past date
   - Make an API request
   - Verify new token is fetched and stored

## Troubleshooting

### "No valid access token available for API request"
- User not signed in with Google
- Token exchange failed (check Network tab for errors to `/auth/google`)
- Verify backend endpoint is accessible

### 401 Unauthorized errors
- Backend token expired and refresh failed
- Backend endpoint unreachable
- Check backend logs for authentication errors

### Token not refreshing
- Google ID token missing from session
- Verify NextAuth callbacks are configured correctly
- Check that `AuthInitializer` is wrapping your app in layout

## Security Notes

- Backend tokens stored in localStorage (consider httpOnly cookies for production)
- Google ID token kept in memory only
- Tokens automatically cleared on logout
- 1-minute expiry buffer prevents race conditions

---

**Ready to test!** Sign in with Google and all API requests will automatically use your backend token. 🎉
