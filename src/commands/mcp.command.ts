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

  const workspaceLabel = credentials.workspaceName ?? credentials.workspaceId ?? 'authenticated workspace';
  process.stderr.write(
    `COUNT MCP server started for ${workspaceLabel}. Listening on stdio — press Ctrl+C to stop.\n`,
  );

  const exitCode = await launchPartnerMcpServer({ credentials });
  process.exit(exitCode);
}

export async function runMcpPrintConfigCommand(): Promise<void> {
  const configuration = buildClaudeCodeMcpConfig();
  process.stdout.write(`${JSON.stringify(configuration, null, 2)}\n`);
}
