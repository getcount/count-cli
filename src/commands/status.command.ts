import { getConfigFilePath, loadCredentials } from '../services/credentialStore.service.js';

export async function runStatusCommand(): Promise<void> {
  const credentials = await loadCredentials();
  const configFilePath = getConfigFilePath();

  if (!credentials) {
    process.stdout.write(`No credentials file at ${configFilePath}\n`);
    process.stdout.write('Run `count init` then `count login`.\n');
    return;
  }

  const status = {
    configFilePath,
    apiBaseUrl: credentials.apiBaseUrl,
    hasClientId: Boolean(credentials.clientId),
    hasClientSecret: Boolean(credentials.clientSecret),
    hasAccessToken: Boolean(credentials.accessToken),
    hasRefreshToken: Boolean(credentials.refreshToken),
    workspaceId: credentials.workspaceId ?? null,
    workspaceName: credentials.workspaceName ?? null,
  };

  process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
}
