import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import type { CountCliCredentials } from '../types.js';
import { getConfigFilePath } from './credentialStore.service.js';

interface BuildMcpEnvironmentParams {
  credentials: CountCliCredentials;
}

export function buildMcpEnvironment(params: BuildMcpEnvironmentParams): NodeJS.ProcessEnv {
  const { credentials } = params;

  return {
    ...process.env,
    COUNT_API_URL: credentials.apiBaseUrl,
    COUNT_CLIENT_ID: credentials.clientId,
    COUNT_CLIENT_SECRET: credentials.clientSecret,
    COUNT_ACCESS_TOKEN: credentials.accessToken ?? '',
    COUNT_REFRESH_TOKEN: credentials.refreshToken ?? '',
    COUNT_REQUEST_TIMEOUT_MS: String(credentials.requestTimeoutMs),
    COUNT_CREDENTIALS_FILE: getConfigFilePath(),
  };
}

export function resolvePartnerMcpEntryPath(): string {
  const currentDirectoryPath = path.dirname(fileURLToPath(import.meta.url));
  return path.join(currentDirectoryPath, '../partner-mcp/index.js');
}

export function resolveCliEntryPath(): string {
  const currentDirectoryPath = path.dirname(fileURLToPath(import.meta.url));
  return path.join(currentDirectoryPath, '../index.js');
}

interface LaunchPartnerMcpServerParams {
  credentials: CountCliCredentials;
}

export async function launchPartnerMcpServer(params: LaunchPartnerMcpServerParams): Promise<number> {
  const entryPath = resolvePartnerMcpEntryPath();
  const environment = buildMcpEnvironment({ credentials: params.credentials });

  return await new Promise<number>((resolve, reject) => {
    const childProcess = spawn(process.execPath, [entryPath], {
      env: environment,
      stdio: 'inherit',
    });

    childProcess.once('error', reject);
    childProcess.once('exit', (exitCode, signal) => {
      if (signal) {
        reject(new Error(`COUNT MCP server exited due to signal ${signal}.`));
        return;
      }

      resolve(exitCode ?? 0);
    });
  });
}

export function buildClaudeCodeMcpConfig(): Record<string, unknown> {
  return {
    mcpServers: {
      count: {
        command: process.execPath,
        args: [resolveCliEntryPath(), 'mcp'],
      },
    },
  };
}
