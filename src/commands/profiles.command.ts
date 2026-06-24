import { getConfigFilePath, loadCredentials } from '../services/credentialStore.service.js';
import {
  DEFAULT_PROFILE_NAME,
  ensureProfileDirectory,
  getActiveProfileName,
  listProfileNames,
  migrateLegacyCredentialsToProfile,
  setActiveProfileName,
} from '../services/profileStore.service.js';
import { runInitCommand } from './init.command.js';

interface RunProfilesListCommandParams {
  profileName?: string;
  json?: boolean;
}

export async function runProfilesListCommand(params: RunProfilesListCommandParams = {}): Promise<void> {
  const profileNames = await listProfileNames();
  const activeProfileName = await getActiveProfileName();

  if (params.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          activeProfile: activeProfileName,
          profiles: profileNames,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  if (profileNames.length === 0) {
    process.stdout.write('No profiles found. Run `count setup` or `count profiles add <name>`.\n');
    return;
  }

  for (const listedProfileName of profileNames) {
    const marker = listedProfileName === activeProfileName ? '*' : ' ';
    let credentials = await loadCredentials({ profileName: listedProfileName });
    if (!credentials && listedProfileName === DEFAULT_PROFILE_NAME) {
      credentials = await loadCredentials();
    }
    const workspaceLabel = credentials?.workspaceName ?? credentials?.workspaceId ?? 'not logged in';
    process.stdout.write(`${marker} ${listedProfileName} — ${workspaceLabel}\n`);
  }
}

interface RunProfilesAddCommandParams {
  profileName: string;
  clientId: string;
  clientSecret: string;
  apiBaseUrl?: string;
}

export async function runProfilesAddCommand(params: RunProfilesAddCommandParams): Promise<void> {
  await ensureProfileDirectory({ profileName: params.profileName });
  await runInitCommand({
    clientId: params.clientId,
    clientSecret: params.clientSecret,
    apiBaseUrl: params.apiBaseUrl,
    profileName: params.profileName,
  });
  process.stdout.write(`Profile "${params.profileName}" saved. Run \`count login --profile ${params.profileName}\`.\n`);
}

interface RunProfilesUseCommandParams {
  profileName: string;
}

export async function runProfilesUseCommand(params: RunProfilesUseCommandParams): Promise<void> {
  await migrateLegacyCredentialsToProfile({ profileName: params.profileName });
  const credentials = await loadCredentials({ profileName: params.profileName });
  if (!credentials) {
    throw new Error(
      `Profile "${params.profileName}" has no credentials yet. Run \`count profiles add ${params.profileName}\` first.`,
    );
  }

  await setActiveProfileName({ profileName: params.profileName });
  process.stdout.write(`Active profile set to "${params.profileName}".\n`);
  process.stdout.write(`Credentials: ${getConfigFilePath({ profileName: params.profileName })}\n`);
}
