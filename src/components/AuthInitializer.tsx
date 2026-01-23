'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { setGoogleIdToken } from '@/lib/api';
import { tokenService } from '@/lib/tokenService';

/**
 * AuthInitializer component that:
 * 1. Gets the Google ID token from NextAuth session
 * 2. Exchanges it for a backend access token
 * 3. Keeps the API client updated with the Google ID token
 * 4. Handles expired Google tokens by forcing re-authentication
 * 5. Blocks rendering until token is ready to prevent race conditions
 */
export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [isTokenReady, setIsTokenReady] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      if (status === 'authenticated' && session?.googleIdToken) {
        const googleIdToken = session.googleIdToken as string;
        
        // Update API client with Google ID token
        setGoogleIdToken(googleIdToken);

        // Exchange for backend token if we don't have a valid one
        if (!tokenService.isTokenValid()) {
          try {
            await tokenService.exchangeGoogleToken(googleIdToken);
            console.log('Backend token initialized successfully');
            setIsTokenReady(true);
          } catch (error: any) {
            console.error('Failed to initialize backend token:', error);
            
            // If Google token is expired, force logout and re-authentication
            if (error.message === 'GOOGLE_TOKEN_EXPIRED') {
              console.log('Google token expired, signing out to force re-authentication');
              await signOut({ callbackUrl: '/auth/signin' });
            }
          }
        } else {
          // Token already valid
          setIsTokenReady(true);
        }
      } else if (status === 'unauthenticated') {
        // Clear token when user logs out
        setGoogleIdToken(null);
        tokenService.clearTokenData();
        setIsTokenReady(true); // Allow rendering for unauthenticated state
      } else if (status === 'loading') {
        // Still loading session
        setIsTokenReady(false);
      }
    };

    initializeAuth();
  }, [session, status]);

  // Show loading state while initializing authentication
  if (status === 'loading' || (status === 'authenticated' && !isTokenReady)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0F1115] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Initializing...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
