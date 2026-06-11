import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import type { CountCliCredentials } from '../types.js';

const require = createRequire(import.meta.url);

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
  };
}

export function resolvePartnerMcpEntryPath(): string {
  // The package root export points at dist/index.js (the stdio MCP entry).
  return require.resolve('@count/partner-mcp');
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

interface BuildClaudeCodeMcpConfigParams {
  credentials: CountCliCredentials;
}

export function buildClaudeCodeMcpConfig(params: BuildClaudeCodeMcpConfigParams): Record<string, unknown> {
  const entryPath = resolvePartnerMcpEntryPath();
  const environment = buildMcpEnvironment({ credentials: params.credentials });

  return {
    mcpServers: {
      count: {
        command: process.execPath,
        args: [entryPath],
        env: {
          COUNT_API_URL: environment.COUNT_API_URL,
          COUNT_CLIENT_ID: environment.COUNT_CLIENT_ID,
          COUNT_CLIENT_SECRET: environment.COUNT_CLIENT_SECRET,
          COUNT_ACCESS_TOKEN: environment.COUNT_ACCESS_TOKEN,
          COUNT_REFRESH_TOKEN: environment.COUNT_REFRESH_TOKEN,
          COUNT_REQUEST_TIMEOUT_MS: environment.COUNT_REQUEST_TIMEOUT_MS,
        },
      },
    },
  };
}
