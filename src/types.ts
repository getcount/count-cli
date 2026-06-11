export interface CountCliCredentials {
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  workspaceId?: string;
  workspaceName?: string;
  requestTimeoutMs: number;
}

export interface OAuthCallbackResult {
  code: string;
  state: string;
}
