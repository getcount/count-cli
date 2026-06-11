import { buildClaudeCodeMcpConfig, launchPartnerMcpServer } from '../services/mcpLauncher.service.js';
import { loadCredentials } from '../services/credentialStore.service.js';

function assertLoggedInCredentials(
  credentials: Awaited<ReturnType<typeof loadCredentials>>,
): asserts credentials is NonNullable<typeof credentials> {
  if (!credentials?.clientId || !credentials.clientSecret) {
    throw new Error('Partner credentials are not configured. Run `count init` first.');
  }

  if (!credentials.accessToken || !credentials.refreshToken) {
    throw new Error('You are not logged in. Run `count login` first.');
  }
}

export async function runMcpStartCommand(): Promise<void> {
  const credentials = await loadCredentials();
  assertLoggedInCredentials(credentials);

  const exitCode = await launchPartnerMcpServer({ credentials });
  process.exit(exitCode);
}

export async function runMcpPrintConfigCommand(): Promise<void> {
  const credentials = await loadCredentials();
  assertLoggedInCredentials(credentials);

  const configuration = buildClaudeCodeMcpConfig({ credentials });
  process.stdout.write(`${JSON.stringify(configuration, null, 2)}\n`);
}
