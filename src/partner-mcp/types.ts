import type { z } from 'zod';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface CountPartnerMcpConfig {
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  requestTimeoutMs: number;
  credentialsFilePath?: string;
}

export interface RequestParams {
  method: HttpMethod;
  path: string;
  signaturePath?: string;
  query?: QueryParams;
  body?: JsonObject;
  requiresUserAuth?: boolean;
  retryOnUnauthorized?: boolean;
}

export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type QueryValue = string | number | boolean | null | undefined | Array<string | number | boolean>;

export interface QueryParams {
  [key: string]: QueryValue;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  workspaceId?: string;
  workspaceName?: string;
}

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  method: HttpMethod;
  pathTemplate: string;
  inputSchema: z.ZodType<Record<string, unknown>>;
  requiresUserAuth: boolean;
  readOnly: boolean;
  destructive: boolean;
  idempotent?: boolean;
}

