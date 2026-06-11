import crypto from 'node:crypto';
import { PartnerApiClient } from '@count/partner-mcp/partner-api-client';
import type { TokenSet } from '@count/partner-mcp/types';
import {
  DEFAULT_CALLBACK_HOST,
  DEFAULT_CALLBACK_PATH,
  DEFAULT_CALLBACK_PORT,
  OAUTH_LOGIN_TIMEOUT_MS,
} from '../constants.js';
import type { CountCliCredentials } from '../types.js';
import { openBrowser } from './browserOpener.service.js';
import { startLocalCallbackServer } from './localCallbackServer.service.js';

interface AuthorizeInitiateResponse {
  status?: string;
  message?: string;
  data?: {
    redirectUri?: string;
  };
}

interface ExchangeTokenResponse {
  status?: string;
  message?: string;
  data?: {
    result?: TokenSet;
  };
}

interface RunOAuthLoginParams {
  credentials: CountCliCredentials;
  callbackHost?: string;
  callbackPort?: number;
  callbackPath?: string;
  openBrowserAutomatically?: boolean;
  fetchImplementation?: typeof fetch;
}

interface RunOAuthLoginResult {
  credentials: CountCliCredentials;
}

function generateOAuthState(): string {
  return crypto.randomBytes(24).toString('hex');
}

interface BuildAuthorizeInitiateUrlParams {
  apiBaseUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
}

function buildAuthorizeInitiateUrl(params: BuildAuthorizeInitiateUrlParams): string {
  const url = new URL('/auth2/authorize-intiate', params.apiBaseUrl);
  url.searchParams.set('clientId', params.clientId);
  url.searchParams.set('redirectUri', params.redirectUri);
  url.searchParams.set('state', params.state);
  return url.toString();
}

export async function runOAuthLogin(params: RunOAuthLoginParams): Promise<RunOAuthLoginResult> {
  const {
    credentials,
    callbackHost = DEFAULT_CALLBACK_HOST,
    callbackPort = DEFAULT_CALLBACK_PORT,
    callbackPath = DEFAULT_CALLBACK_PATH,
    openBrowserAutomatically = true,
    fetchImplementation = fetch,
  } = params;
  const oauthState = generateOAuthState();
  const callbackServer = await startLocalCallbackServer({
    host: callbackHost,
    port: callbackPort,
    callbackPath,
    expectedState: oauthState,
    timeoutMs: OAUTH_LOGIN_TIMEOUT_MS,
  });

  try {
    const initiateUrl = buildAuthorizeInitiateUrl({
      apiBaseUrl: credentials.apiBaseUrl,
      clientId: credentials.clientId,
      redirectUri: callbackServer.redirectUri,
      state: oauthState,
    });

    const initiateResponse = await fetchImplementation(initiateUrl, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    const initiateBody = (await initiateResponse.json()) as AuthorizeInitiateResponse;

    if (!initiateResponse.ok) {
      throw new Error(initiateBody.message ?? `Failed to start OAuth login (${initiateResponse.status}).`);
    }

    const browserUrl = initiateBody.data?.redirectUri;
    if (!browserUrl) {
      throw new Error('COUNT did not return a partner sign-in URL.');
    }

    if (openBrowserAutomatically) {
      await openBrowser({ url: browserUrl });
    } else {
      process.stdout.write(`Open this URL in your browser to sign in:\n${browserUrl}\n`);
    }

    process.stdout.write('Waiting for OAuth callback...\n');
    const callbackResult = await callbackServer.waitForCallback();

    const partnerClient = new PartnerApiClient({
      config: {
        apiBaseUrl: credentials.apiBaseUrl,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        requestTimeoutMs: credentials.requestTimeoutMs,
      },
      fetchImplementation,
    });

    const exchangeResponse = await partnerClient.request<ExchangeTokenResponse>({
      method: 'POST',
      path: '/partners/grant-access-token',
      body: {
        grantType: 'authorization_code',
        code: callbackResult.code,
        state: callbackResult.state,
      },
      requiresUserAuth: false,
      retryOnUnauthorized: false,
    });

    const tokenSet = exchangeResponse.data?.result;
    if (!tokenSet?.accessToken || !tokenSet.refreshToken) {
      throw new Error('Token exchange succeeded but did not return access and refresh tokens.');
    }

    return {
      credentials: {
        ...credentials,
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
        workspaceId: tokenSet.workspaceId,
        workspaceName: tokenSet.workspaceName,
      },
    };
  } finally {
    await callbackServer.close();
  }
}
