import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

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
  ],
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, account }) {
      // Store Google ID token in JWT on initial sign-in
      if (account?.id_token) {
        token.googleIdToken = account.id_token;
      }
      return token;
    },
    async session({ session, token }) {
      // Pass Google ID token to session for client-side use
      if (token.googleIdToken) {
        session.googleIdToken = token.googleIdToken as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnSignIn = nextUrl.pathname.startsWith('/auth/signin')
      
      // Allow access to sign-in page
      if (isOnSignIn) {
        return true
      }
      
      // Require authentication for all other pages
      if (!isLoggedIn) {
        return false
      }
      
      return true
    },
  },
})
