import { getConfigFilePath, loadCredentials } from '../services/credentialStore.service.js';
import { getActiveProfileName } from '../services/profileStore.service.js';

interface RunStatusCommandParams {
  profileName?: string;
  json?: boolean;
}

export async function runStatusCommand(params: RunStatusCommandParams = {}): Promise<void> {
  const credentials = await loadCredentials({ profileName: params.profileName });
  const configFilePath = getConfigFilePath({ profileName: params.profileName });
  const activeProfileName = await getActiveProfileName();

  if (!credentials) {
    process.stdout.write(`No credentials file at ${configFilePath}\n`);
    process.stdout.write('Run `count init` then `count login`, or run `count setup`.\n');
    return;
  }

  const status = {
    activeProfile: params.profileName ?? activeProfileName,
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
