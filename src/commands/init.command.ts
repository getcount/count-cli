import {
  DEFAULT_API_BASE_URL,
  DEFAULT_CALLBACK_HOST,
  DEFAULT_CALLBACK_PATH,
  DEFAULT_CALLBACK_PORT,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEVELOPER_DOCS_URL,
  PARTNERS_PORTAL_URL,
} from '../constants.js';
import {
  buildDefaultCredentials,
  getConfigFilePath,
  loadCredentials,
  saveCredentials,
} from '../services/credentialStore.service.js';
import { ensureProfileDirectory, setActiveProfileName } from '../services/profileStore.service.js';

interface RunInitCommandParams {
  clientId: string;
  clientSecret: string;
  apiBaseUrl?: string;
  configFilePath?: string;
  profileName?: string;
}

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, '');
}

export async function runInitCommand(params: RunInitCommandParams): Promise<void> {
  if (params.profileName) {
    await ensureProfileDirectory({ profileName: params.profileName });
    await setActiveProfileName({ profileName: params.profileName });
  }

  const configFilePath =
    params.configFilePath ?? getConfigFilePath({ profileName: params.profileName });
  const existingCredentials = await loadCredentials({ configFilePath });
  const resolvedApiBaseUrl = normalizeApiBaseUrl(
    params.apiBaseUrl ?? existingCredentials?.apiBaseUrl ?? DEFAULT_API_BASE_URL,
  );
  const apiBaseUrlChanged = Boolean(
    existingCredentials?.apiBaseUrl &&
      normalizeApiBaseUrl(existingCredentials.apiBaseUrl) !== resolvedApiBaseUrl,
  );
  const shouldPreserveLoginTokens =
    !apiBaseUrlChanged && Boolean(existingCredentials?.accessToken && existingCredentials.refreshToken);

  const credentials = {
    ...buildDefaultCredentials({
      clientId: params.clientId,
      clientSecret: params.clientSecret,
      apiBaseUrl: resolvedApiBaseUrl,
    }),
    ...(shouldPreserveLoginTokens
      ? {
          accessToken: existingCredentials?.accessToken,
          refreshToken: existingCredentials?.refreshToken,
          workspaceId: existingCredentials?.workspaceId,
          workspaceName: existingCredentials?.workspaceName,
        }
      : {}),
    requestTimeoutMs: existingCredentials?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
  };

  await saveCredentials({ credentials, configFilePath });

  if (shouldPreserveLoginTokens) {
    process.stdout.write('Existing login tokens were preserved. Run `count login` again if you changed client credentials.\n\n');
  } else if (apiBaseUrlChanged && existingCredentials?.accessToken) {
    process.stdout.write('API URL changed — stored login tokens were cleared. Run `count login` for the new environment.\n\n');
  }

  const redirectUri = `http://${DEFAULT_CALLBACK_HOST}:${DEFAULT_CALLBACK_PORT}${DEFAULT_CALLBACK_PATH}`;

  process.stdout.write(`Saved COUNT CLI credentials to ${configFilePath}\n\n`);
  process.stdout.write('Before running `count login`, register this redirect URI on your partner app:\n');
  process.stdout.write(`  ${redirectUri}\n\n`);
  process.stdout.write(`Partner apps: ${PARTNERS_PORTAL_URL}\n`);
  process.stdout.write(`API docs: ${DEVELOPER_DOCS_URL}\n`);
}
