import { deleteCredentials, getConfigFilePath } from '../services/credentialStore.service.js';

interface RunLogoutCommandParams {
  profileName?: string;
}

export async function runLogoutCommand(params: RunLogoutCommandParams = {}): Promise<void> {
  await deleteCredentials({ profileName: params.profileName });
  process.stdout.write(`Removed stored credentials from ${getConfigFilePath({ profileName: params.profileName })}\n`);
}
