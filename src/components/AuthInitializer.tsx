'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { setGoogleIdToken } from '@/lib/api';
import { tokenService } from '@/lib/tokenService';

/**
 * AuthInitializer component that:
 * 1. Gets the Google ID token from NextAuth session
 * 2. Exchanges it for a backend access token
 * 3. Keeps the API client updated with the Google ID token
 */
export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

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
          } catch (error) {
            console.error('Failed to initialize backend token:', error);
          }
        }
      } else if (status === 'unauthenticated') {
        // Clear token when user logs out
        setGoogleIdToken(null);
        tokenService.clearTokenData();
      }
    };

    initializeAuth();
  }, [session, status]);

  return <>{children}</>;
}
