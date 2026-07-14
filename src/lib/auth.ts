import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import axios from "axios"
import type { BackendTokenData } from "@/types/next-auth"
import { getPostHogClient } from "@/lib/posthog-server"

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || 'TEST_SECRET',
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
    Credentials({
      credentials: {
        username: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const body = new URLSearchParams();
        body.append('username', credentials.username as string);
        body.append('password', credentials.password as string);

        try {
          const response = await axios.post(`${baseURL}/auth/admin/login`, body.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });

          const data = response.data;

          const backendTokenData: BackendTokenData = {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            user_id: data.user_id,
            expires_at: data.expires_at,
          };

          return {
            id: data.user_id,
            email: credentials.username as string,
            backendTokenData,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  events: {
    async signIn({ user, account }) {
      const posthog = getPostHogClient();
      if (!posthog || !user.email) return;
      posthog.capture({
        distinctId: user.email,
        event: 'user_signed_in',
        properties: {
          provider: account?.provider ?? 'unknown',
        },
      });
      await posthog.flush();
    },
  },
  callbacks: {
    async jwt({ token, account, user }) {
      // Store Google ID token in JWT on initial Google sign-in
      if (account?.id_token) {
        token.googleIdToken = account.id_token;
      }
      // Store backend token data in JWT on initial credentials sign-in
      if (user?.backendTokenData) {
        token.backendTokenData = user.backendTokenData as BackendTokenData;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.googleIdToken) {
        session.googleIdToken = token.googleIdToken as string;
      }
      if (token.backendTokenData) {
        session.backendTokenData = token.backendTokenData as BackendTokenData;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnSignIn = nextUrl.pathname.startsWith('/auth/signin')

      if (isOnSignIn) {
        return true
      }

      if (!isLoggedIn) {
        return false
      }

      return true
    },
  },
})
