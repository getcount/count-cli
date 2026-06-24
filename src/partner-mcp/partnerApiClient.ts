import { computePartnerSignature } from './signing.js';
import * as tokenPersistence from './tokenPersistence.js';
import type { CountPartnerMcpConfig, JsonObject, QueryParams, RequestParams, TokenSet } from './types.js';

interface PartnerApiClientParams {
  config: CountPartnerMcpConfig;
  fetchImplementation?: typeof fetch;
  currentTimeMs?: () => number;
}

interface BuildHeadersParams {
  method: RequestParams['method'];
  path: string;
  signaturePath?: string;
  body?: JsonObject;
  requiresUserAuth: boolean;
}

interface RefreshTokenResponse {
  status?: string;
  data?: {
    result?: TokenSet;
  };
}

interface CountApiErrorBody {
  message?: string;
  statusCode?: number;
  error?: string;
  error_description?: string;
  [key: string]: unknown;
}

interface BuildUrlParams {
  path: string;
  query?: QueryParams;
}

interface BuildRequestBodyParams {
  method: RequestParams['method'];
  body?: JsonObject;
}

interface ParseResponseBodyParams {
  response: Response;
}

interface GetErrorMessageParams {
  statusCode: number;
  responseBody: unknown;
}

interface ShouldRefreshAfterErrorParams {
  error: PartnerApiError;
}

export class PartnerApiError extends Error {
  public readonly statusCode: number;
  public readonly responseBody: unknown;

  constructor(message: string, statusCode: number, responseBody: unknown) {
    super(message);
    this.name = 'PartnerApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

export class PartnerApiClient {
  private readonly config: CountPartnerMcpConfig;
  private readonly fetchImplementation: typeof fetch;
  private readonly currentTimeMs: () => number;
  private accessToken?: string;
  private refreshToken?: string;
  private inFlightRefresh: Promise<void> | null = null;

  constructor(params: PartnerApiClientParams) {
    const { config, fetchImplementation = fetch, currentTimeMs = Date.now } = params;
    this.config = config;
    this.fetchImplementation = fetchImplementation;
    this.currentTimeMs = currentTimeMs;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
  }

  public getAuthState(): Record<string, boolean | string> {
    return {
      apiBaseUrl: this.config.apiBaseUrl,
      hasClientId: Boolean(this.config.clientId),
      hasClientSecret: Boolean(this.config.clientSecret),
      hasAccessToken: Boolean(this.accessToken),
      hasRefreshToken: Boolean(this.refreshToken),
    };
  }

  public async request<TResponse = unknown>(params: RequestParams): Promise<TResponse> {
    const {
      method,
      path,
      signaturePath,
      query,
      body,
      requiresUserAuth = true,
      retryOnUnauthorized = true,
    } = params;

    const response = await this.performRequest<TResponse>({
      method,
      path,
      signaturePath,
      query,
      body,
      requiresUserAuth,
    });

    if (!(response instanceof PartnerApiError)) {
      return response;
    }

    if (
      requiresUserAuth &&
      retryOnUnauthorized &&
      this.refreshToken &&
      this.shouldRefreshAfterError({ error: response })
    ) {
      await this.refreshAccessToken();
      const retryResponse = await this.performRequest<TResponse>({
        method,
        path,
        signaturePath,
        query,
        body,
        requiresUserAuth,
      });

      if (!(retryResponse instanceof PartnerApiError)) {
        return retryResponse;
      }

      throw retryResponse;
    }

    throw response;
  }

  public async refreshAccessToken(): Promise<void> {
    if (this.inFlightRefresh) {
      await this.inFlightRefresh;
      return;
    }

    const refreshPromise = this.performRefreshAccessToken();
    this.inFlightRefresh = refreshPromise;
    try {
      await refreshPromise;
    } finally {
      this.inFlightRefresh = null;
    }
  }

  private async performRefreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new PartnerApiError('No refresh token is configured for this MCP server.', 401, {
        message: 'Missing COUNT_REFRESH_TOKEN',
      });
    }

    const response = await this.request<RefreshTokenResponse>({
      method: 'POST',
      path: '/partners/refresh-user-access-token',
      body: {
        grantType: 'refresh_token',
        refreshToken: this.refreshToken,
      },
      requiresUserAuth: false,
      retryOnUnauthorized: false,
    });

    const tokenSet = response.data?.result;
    if (!tokenSet?.accessToken || !tokenSet.refreshToken) {
      throw new PartnerApiError('Refresh token response did not include a token set.', 502, response);
    }

    this.accessToken = tokenSet.accessToken;
    this.refreshToken = tokenSet.refreshToken;

    if (this.config.credentialsFilePath) {
      await tokenPersistence.persistRefreshedTokens({
        credentialsFilePath: this.config.credentialsFilePath,
        accessToken: tokenSet.accessToken,
        refreshToken: tokenSet.refreshToken,
      });
    }
  }

  private async performRequest<TResponse>(params: RequestParams): Promise<TResponse | PartnerApiError> {
    const { method, path, signaturePath, query, body, requiresUserAuth = true } = params;
    const url = this.buildUrl({ path, query });
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.config.requestTimeoutMs);

    try {
      const response = await this.fetchImplementation(url, {
        method,
        headers: this.buildHeaders({ method, path, signaturePath, body, requiresUserAuth }),
        body: this.buildRequestBody({ method, body }),
        signal: abortController.signal,
      });

      const responseBody = await this.parseResponseBody({ response });
      if (!response.ok) {
        return new PartnerApiError(
          this.getErrorMessage({ statusCode: response.status, responseBody }),
          response.status,
          responseBody,
        );
      }

      return responseBody as TResponse;
    } catch (error: unknown) {
      if (error instanceof PartnerApiError) {
        return error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        return new PartnerApiError(`COUNT API request timed out after ${this.config.requestTimeoutMs}ms.`, 408, {
          message: error.message,
        });
      }

      const message = error instanceof Error ? error.message : String(error);
      return new PartnerApiError(`COUNT API request failed: ${message}`, 502, { message });
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUrl(params: BuildUrlParams): string {
    const { path, query } = params;
    const url = new URL(path, this.config.apiBaseUrl);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
        continue;
      }

      url.searchParams.set(key, String(value));
    }

    return url.toString();
  }

  private buildHeaders(params: BuildHeadersParams): HeadersInit {
    const { method, path, signaturePath, body, requiresUserAuth } = params;
    const timestamp = String(this.currentTimeMs());
    const signature = computePartnerSignature({
      method,
      path: signaturePath ?? toPartnerRouterPath({ path }),
      timestamp,
      body,
      clientSecret: this.config.clientSecret,
    });
    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-client-id': this.config.clientId,
      'x-timestamp': timestamp,
      'x-signature': signature,
    };

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      headers['content-type'] = 'application/json';
    }

    if (requiresUserAuth) {
      if (!this.accessToken) {
        throw new PartnerApiError('No access token is configured for this MCP server.', 401, {
          message: 'Missing COUNT_ACCESS_TOKEN',
        });
      }

      headers.authorization = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  private buildRequestBody(params: BuildRequestBodyParams): BodyInit | undefined {
    const { method, body } = params;
    if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') {
      return undefined;
    }

    return JSON.stringify(body ?? {});
  }

  private async parseResponseBody(params: ParseResponseBodyParams): Promise<unknown> {
    const { response } = params;
    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();

    if (!text) {
      return null;
    }

    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    return text;
  }

  private getErrorMessage(params: GetErrorMessageParams): string {
    const { statusCode, responseBody } = params;
    if (responseBody && typeof responseBody === 'object') {
      const errorBody = responseBody as CountApiErrorBody;
      return errorBody.error_description ?? errorBody.message ?? `COUNT API returned ${statusCode}.`;
    }

    return `COUNT API returned ${statusCode}.`;
  }

  private shouldRefreshAfterError(params: ShouldRefreshAfterErrorParams): boolean {
    const { error } = params;

    if (error.statusCode === 403) {
      return this.isStaleAccessTokenError({ error });
    }

    if (error.statusCode !== 401) {
      return false;
    }

    if (this.isStaleAccessTokenError({ error })) {
      return true;
    }

    if (!error.responseBody || typeof error.responseBody !== 'object') {
      return false;
    }

    const errorBody = error.responseBody as CountApiErrorBody;
    if (errorBody.error === 'missing_credentials' || errorBody.error === 'Invalid HMAC signature') {
      return false;
    }

    return (
      errorBody.error === 'invalid_token' ||
      errorBody.error_description === 'The access token expired'
    );
  }

  /** Legacy deployments returned stale rotated tokens as 403 before protectUser emitted 401. */
  private isStaleAccessTokenError(params: ShouldRefreshAfterErrorParams): boolean {
    const { error } = params;
    if (error.message === 'Invalid access token.') {
      return true;
    }

    if (!error.responseBody || typeof error.responseBody !== 'object') {
      return false;
    }

    const errorBody = error.responseBody as CountApiErrorBody;
    return errorBody.message === 'Invalid access token.';
  }
}

interface ToPartnerRouterPathParams {
  path: string;
}

export function toPartnerRouterPath(params: ToPartnerRouterPathParams): string {
  const { path } = params;

  if (path === '/partners') {
    return '/';
  }

  if (path.startsWith('/partners/')) {
    return path.slice('/partners'.length);
  }

  return path;
}

