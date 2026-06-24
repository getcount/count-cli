import {
  DEFAULT_API_BASE_URL,
  DEFAULT_CALLBACK_HOST,
  DEFAULT_CALLBACK_PATH,
  DEFAULT_CALLBACK_PORT,
  PARTNERS_PORTAL_URL,
} from '../constants.js';
import { runDoctorCommand } from './doctor.command.js';
import { runInitCommand } from './init.command.js';
import { runLoginCommand } from './login.command.js';
import { runMcpInstallCommand } from './mcpInstall.command.js';
import { getConfigFilePath, loadCredentials } from '../services/credentialStore.service.js';
import {
  DEFAULT_PROFILE_NAME,
  ensureProfileDirectory,
  setActiveProfileName,
} from '../services/profileStore.service.js';
import {
  createPromptInterface,
  promptChoice,
  promptLine,
  promptYesNo,
} from '../services/setupPrompt.service.js';

interface RunSetupCommandParams {
  profileName?: string;
  skipLogin?: boolean;
  skipInstall?: boolean;
  nonInteractive?: boolean;
  clientId?: string;
  clientSecret?: string;
  apiBaseUrl?: string;
}

export async function runSetupCommand(params: RunSetupCommandParams = {}): Promise<number> {
  const readlineInterface = createPromptInterface();

  try {
    process.stdout.write('COUNT CLI setup\n');
    process.stdout.write('This wizard saves partner credentials, signs you in, installs MCP config, and runs health checks.\n\n');

    const profileName =
      params.profileName ??
      (params.nonInteractive
        ? DEFAULT_PROFILE_NAME
        : await promptLine({
            readlineInterface,
            question: 'Profile name',
            defaultValue: DEFAULT_PROFILE_NAME,
          }));

    await ensureProfileDirectory({ profileName });
    await setActiveProfileName({ profileName });

    const existingCredentials = await loadCredentials({ profileName });
    let clientId = params.clientId ?? existingCredentials?.clientId;
    let clientSecret = params.clientSecret ?? existingCredentials?.clientSecret;
    let apiBaseUrl = params.apiBaseUrl ?? existingCredentials?.apiBaseUrl ?? DEFAULT_API_BASE_URL;

    if (!clientId || !clientSecret) {
      if (params.nonInteractive) {
        throw new Error('Partner credentials are required. Pass --client-id and --client-secret for non-interactive setup.');
      }

      process.stdout.write(`Create a partner app at ${PARTNERS_PORTAL_URL} if you have not already.\n\n`);
      clientId = await promptLine({ readlineInterface, question: 'Partner client ID' });
      clientSecret = await promptLine({ readlineInterface, question: 'Partner client secret' });
      apiBaseUrl = await promptLine({
        readlineInterface,
        question: 'API base URL',
        defaultValue: apiBaseUrl,
      });
    }

    if (!clientId || !clientSecret) {
      throw new Error('Partner client ID and client secret are required.');
    }

    await runInitCommand({
      clientId,
      clientSecret,
      apiBaseUrl,
      profileName,
    });

    const redirectUri = `http://${DEFAULT_CALLBACK_HOST}:${DEFAULT_CALLBACK_PORT}${DEFAULT_CALLBACK_PATH}`;
    process.stdout.write(`\nEnsure this redirect URI is registered on your partner app:\n  ${redirectUri}\n\n`);

    const shouldLogin =
      !params.skipLogin &&
      (params.nonInteractive
        ? !(await loadCredentials({ profileName }))?.accessToken
        : await promptYesNo({
            readlineInterface,
            question: 'Sign in to COUNT now?',
            defaultYes: true,
          }));

    if (shouldLogin) {
      await runLoginCommand({ profileName });
    }

    if (!params.skipInstall && !params.nonInteractive) {
      const installChoice = await promptChoice({
        readlineInterface,
        question: 'Install MCP config for',
        choices: ['skip', 'cursor', 'claude-code', 'claude-desktop', 'all'],
        defaultChoice: 'cursor',
      });

      if (installChoice !== 'skip') {
        await runMcpInstallCommand({ target: installChoice as 'cursor' | 'claude-code' | 'claude-desktop' | 'all' });
      }
    }

    process.stdout.write('\nRunning health checks...\n\n');
    const doctorExitCode = await runDoctorCommand({ profileName });

    process.stdout.write(`\nSetup complete for profile "${profileName}".\n`);
    process.stdout.write(`Credentials: ${getConfigFilePath({ profileName })}\n`);
    process.stdout.write('Run `count mcp` to start the local MCP server.\n');

    return doctorExitCode;
  } finally {
    readlineInterface.close();
  }
}
