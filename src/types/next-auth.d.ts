export interface BackendTokenData {
  access_token: string;
  refresh_token: string;
  user_id: string;
  expires_at: string;
}

declare module "next-auth" {
  interface Session {
    googleIdToken?: string;
    backendTokenData?: BackendTokenData;
  }

  interface User {
    backendTokenData?: BackendTokenData;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    googleIdToken?: string;
    backendTokenData?: BackendTokenData;
  }
}
