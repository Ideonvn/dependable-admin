'use client';

import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import posthog from 'posthog-js';
import { setGoogleIdToken } from '@/lib/api';
import { tokenService } from '@/lib/tokenService';
import { userSetupService } from '@/lib/userSetupService';

type InitStep = 'idle' | 'token' | 'setup' | 'done';

/**
 * AuthInitializer component that:
 * 1. Handles both Google OAuth and credentials auth flows
 * 2. Acquires and validates the backend access token
 * 3. Calls /users/me/admin/setup to load the user's admin profile
 * 4. Blocks rendering with a contextual loading screen until both steps complete
 * 5. Forces re-login on expired/invalid refresh tokens
 */
export default function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [step, setStep] = useState<InitStep>('idle');

  useEffect(() => {
    const initializeAuth = async () => {
      if (step === 'done') return;

      if (status === 'authenticated') {
        try {
          setStep('token');

          if (session?.googleIdToken) {
            // Google auth flow
            const googleIdToken = session.googleIdToken as string;
            setGoogleIdToken(googleIdToken);

            if (!tokenService.isTokenValid()) {
              await tokenService.getValidToken(googleIdToken);
            }
          } else if (session?.backendTokenData) {
            // Credentials auth flow — seed localStorage from session if nothing stored
            if (!tokenService.getTokenData()) {
              tokenService.setTokenData(session.backendTokenData);
            }

            if (!tokenService.isTokenValid()) {
              await tokenService.getValidToken();
            }
          }

          // Fetch admin setup data after token is ready
          setStep('setup');
          const setupData = await userSetupService.fetchAndStore();

          posthog.identify(setupData.email, {
            email: setupData.email,
            name: `${setupData.first_name} ${setupData.last_name}`.trim(),
            is_admin: setupData.is_admin,
          });

          setStep('done');
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '';
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;
          // Any failure during bootstrap means we can't authenticate — send the
          // user back to sign-in instead of leaving them stuck on the loader.
          const isAuthError =
            message === 'REFRESH_TOKEN_EXPIRED' ||
            message === 'GOOGLE_TOKEN_EXPIRED' ||
            status === 401 ||
            status === 403;

          if (isAuthError) {
            console.error('Auth failed during bootstrap, signing out:', message || status);
            posthog.capture('session_expired', { reason: message || `http_${status}` });
            posthog.reset();
            tokenService.clearTokenData();
            userSetupService.clearSetupData();
            setGoogleIdToken(null);
            await signOut({ callbackUrl: '/auth/signin' });
          } else {
            console.error('Failed to initialize auth:', error);
          }
        }
      } else if (status === 'unauthenticated') {
        setGoogleIdToken(null);
        tokenService.clearTokenData();
        userSetupService.clearSetupData();
        setStep('done');
      }
      // status === 'loading': do nothing, wait for next effect run
    };

    initializeAuth();
  }, [session, status]);

  const isReady = step === 'done' || status === 'unauthenticated';
  const isAuthenticated = status === 'authenticated';

  if (status === 'loading' || (isAuthenticated && !isReady)) {
    const label = step === 'setup' ? 'Setting up your workspace…' : 'Initializing…';

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0F1115] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#1A1A6D] dark:border-[#20B2AA] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{label}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
