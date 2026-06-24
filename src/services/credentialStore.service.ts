import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { DEFAULT_API_BASE_URL, DEFAULT_REQUEST_TIMEOUT_MS } from '../constants.js';
import type { CountCliCredentials } from '../types.js';
import { resolveCredentialsFilePath } from './profileStore.service.js';

export { getConfigDirectoryPath } from './profileStore.service.js';

const credentialsSchema = z.object({
  apiBaseUrl: z.string().trim().min(1),
  clientId: z.string().trim().min(1),
  clientSecret: z.string().trim().min(1),
  accessToken: z.string().trim().min(1).optional(),
  refreshToken: z.string().trim().min(1).optional(),
  workspaceId: z.string().trim().min(1).optional(),
  workspaceName: z.string().trim().min(1).optional(),
  requestTimeoutMs: z.number().int().positive(),
});

interface GetConfigFilePathParams {
  homeDirectory?: string;
  profileName?: string;
}

export function getConfigFilePath(params: GetConfigFilePathParams = {}): string {
  return resolveCredentialsFilePath({
    profileName: params.profileName,
    homeDirectory: params.homeDirectory,
  });
}

interface LoadCredentialsParams {
  configFilePath?: string;
  profileName?: string;
  homeDirectory?: string;
}

export async function loadCredentials(params: LoadCredentialsParams = {}): Promise<CountCliCredentials | null> {
  const configFilePath =
    params.configFilePath ??
    resolveCredentialsFilePath({
      profileName: params.profileName,
      homeDirectory: params.homeDirectory,
    });

  try {
    const rawContents = await fs.readFile(configFilePath, 'utf8');
    const parsedJson = JSON.parse(rawContents) as unknown;
    return credentialsSchema.parse(parsedJson);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

interface SaveCredentialsParams {
  credentials: CountCliCredentials;
  configFilePath?: string;
  profileName?: string;
  homeDirectory?: string;
}

export async function saveCredentials(params: SaveCredentialsParams): Promise<void> {
  const configFilePath =
    params.configFilePath ??
    resolveCredentialsFilePath({
      profileName: params.profileName,
      homeDirectory: params.homeDirectory,
    });
  const configDirectoryPath = path.dirname(configFilePath);
  const validatedCredentials = credentialsSchema.parse(params.credentials);

  await fs.mkdir(configDirectoryPath, { recursive: true, mode: 0o700 });
  await fs.writeFile(configFilePath, `${JSON.stringify(validatedCredentials, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}

interface DeleteCredentialsParams {
  configFilePath?: string;
  profileName?: string;
  homeDirectory?: string;
}

export async function deleteCredentials(params: DeleteCredentialsParams = {}): Promise<void> {
  const configFilePath =
    params.configFilePath ??
    resolveCredentialsFilePath({
      profileName: params.profileName,
      homeDirectory: params.homeDirectory,
    });

  try {
    await fs.unlink(configFilePath);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }
}

interface BuildDefaultCredentialsParams {
  clientId: string;
  clientSecret: string;
  apiBaseUrl?: string;
}

export function buildDefaultCredentials(params: BuildDefaultCredentialsParams): CountCliCredentials {
  return {
    apiBaseUrl: (params.apiBaseUrl ?? DEFAULT_API_BASE_URL).replace(/\/+$/, ''),
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
  };
}
