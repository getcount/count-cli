import { deleteCredentials, getConfigFilePath } from '../services/credentialStore.service.js';

export async function runLogoutCommand(): Promise<void> {
  await deleteCredentials();
  process.stdout.write(`Removed stored credentials from ${getConfigFilePath()}\n`);
}
