// Token management service for backend API authentication
import axios from 'axios';

interface TokenData {
  access_token: string;
  expires_at: string;
  refresh_token?: string;
  user_id?: string;
}

const TOKEN_STORAGE_KEY = 'backend_token_data';

export const tokenService = {
  // Store token data in localStorage
  setTokenData(data: TokenData): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(data));
    }
  },

  // Get token data from localStorage
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

  // Clear token data
  clearTokenData(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  },

  // Check if token is expired or missing
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

  // Get current access token
  getAccessToken(): string | null {
    const tokenData = this.getTokenData();
    return tokenData?.access_token || null;
  },

  // Exchange Google token for backend token
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
    } catch (error: any) {
      // Check for 403 error indicating expired/invalid Google token
      if (error.response?.status === 403) {
        console.error('Google token expired or invalid, clearing token data');
        this.clearTokenData();
        throw new Error('GOOGLE_TOKEN_EXPIRED');
      }
      throw error;
    }
  },

  // Get valid token (refresh if needed)
  async getValidToken(googleIdToken?: string): Promise<string | null> {
    // Check if current token is valid
    if (this.isTokenValid()) {
      return this.getAccessToken();
    }

    // Token expired or missing, need to refresh
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

    // No Google token available to refresh
    this.clearTokenData();
    return null;
  },
};
