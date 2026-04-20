// Token management service for backend API authentication
import axios from 'axios';
import type { BackendTokenData } from '@/types/next-auth';

// TokenData mirrors BackendTokenData but keeps refresh_token optional
// for backwards compatibility with existing stored tokens.
interface TokenData {
  access_token: string;
  expires_at: string;
  refresh_token?: string;
  user_id?: string;
}

const TOKEN_STORAGE_KEY = 'backend_token_data';

export const tokenService = {
  setTokenData(data: TokenData | BackendTokenData): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(data));
    }
  },

  getTokenData(): TokenData | null {
    if (typeof window === 'undefined') return null;
    const data = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data) as TokenData;
    } catch {
      return null;
    }
  },

  clearTokenData(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  },

  isTokenValid(): boolean {
    const tokenData = this.getTokenData();
    if (!tokenData || !tokenData.access_token || !tokenData.expires_at) {
      return false;
    }

    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();
    // Add 1 minute buffer to refresh before actual expiry
    const bufferMs = 60 * 1000;
    return expiresAt.getTime() - now.getTime() > bufferMs;
  },

  getAccessToken(): string | null {
    const tokenData = this.getTokenData();
    return tokenData?.access_token || null;
  },

  // Exchange Google ID token for a backend token
  async exchangeGoogleToken(googleIdToken: string): Promise<TokenData> {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    try {
      const response = await axios.post(`${baseURL}/auth/admin/google?token=${googleIdToken}`);

      const tokenData: TokenData = {
        access_token: response.data.access_token,
        expires_at: response.data.expires_at,
        refresh_token: response.data.refresh_token,
        user_id: response.data.user_id,
      };

      this.setTokenData(tokenData);
      return tokenData;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
        console.error('Google token expired or invalid (status: ' + error.response.status + '), clearing token data');
        this.clearTokenData();
        throw new Error('GOOGLE_TOKEN_EXPIRED');
      }
      throw error;
    }
  },

  // Use the stored refresh token to get a new access token
  async refreshBackendToken(): Promise<TokenData> {
    const stored = this.getTokenData();
    if (!stored?.refresh_token) {
      throw new Error('NO_REFRESH_TOKEN');
    }

    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

    try {
      const response = await axios.post(`${baseURL}/auth/refresh`, {
        refresh_token: stored.refresh_token,
      });

      const tokenData: TokenData = {
        access_token: response.data.access_token,
        expires_at: response.data.expires_at,
        refresh_token: response.data.refresh_token,
        user_id: response.data.user_id,
      };

      this.setTokenData(tokenData);
      return tokenData;
    } catch {
      // Any non-2xx response means the refresh token is invalid or expired
      this.clearTokenData();
      throw new Error('REFRESH_TOKEN_EXPIRED');
    }
  },

  // Get a valid access token, refreshing or re-exchanging as needed.
  // Throws 'REFRESH_TOKEN_EXPIRED' if the refresh token is no longer valid.
  // Throws 'GOOGLE_TOKEN_EXPIRED' if the Google token is no longer valid.
  async getValidToken(googleIdToken?: string): Promise<string | null> {
    if (this.isTokenValid()) {
      return this.getAccessToken();
    }

    // Try refresh token first (works for both Google and credentials users)
    const stored = this.getTokenData();
    if (stored?.refresh_token) {
      const tokenData = await this.refreshBackendToken(); // throws on failure
      return tokenData.access_token;
    }

    // No refresh token — fall back to Google token exchange
    if (googleIdToken) {
      try {
        const tokenData = await this.exchangeGoogleToken(googleIdToken);
        return tokenData.access_token;
      } catch (error) {
        console.error('Failed to exchange Google token:', error);
        this.clearTokenData();
        return null;
      }
    }

    this.clearTokenData();
    return null;
  },
};
