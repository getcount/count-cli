import { runOAuthLogin } from '../services/oauthLogin.service.js';
import { getConfigFilePath, loadCredentials, saveCredentials } from '../services/credentialStore.service.js';

interface RunLoginCommandParams {
  callbackPort?: number;
  openBrowserAutomatically?: boolean;
}

export async function runLoginCommand(params: RunLoginCommandParams = {}): Promise<void> {
  const credentials = await loadCredentials();

  if (!credentials?.clientId || !credentials.clientSecret) {
    throw new Error(
      'Partner credentials are not configured. Run `count init --client-id <id> --client-secret <secret>` first.',
    );
  }

  const loginResult = await runOAuthLogin({
    credentials,
    callbackPort: params.callbackPort,
    openBrowserAutomatically: params.openBrowserAutomatically,
  });

  await saveCredentials({ credentials: loginResult.credentials });

  const workspaceLabel = loginResult.credentials.workspaceName ?? loginResult.credentials.workspaceId ?? 'workspace';
  process.stdout.write(`Logged in to ${workspaceLabel}.\n`);
  process.stdout.write(`Credentials saved to ${getConfigFilePath()}\n`);
  process.stdout.write('Run `count mcp` to start the local MCP server or `count mcp print-config` for Claude Code.\n');
}
