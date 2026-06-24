import {
  CLI_VERSION,
  DEFAULT_CALLBACK_HOST,
  DEFAULT_CALLBACK_PATH,
  DEFAULT_CALLBACK_PORT,
  DEVELOPER_DOCS_URL,
  PARTNERS_PORTAL_URL,
} from '../constants.js';
import { PartnerApiClient } from '../partner-mcp/partnerApiClient.js';
import { toolDefinitions } from '../partner-mcp/tools/definitions.js';
import type { CountCliCredentials } from '../types.js';
import { getActiveProfileName, resolveCredentialsFilePath } from './profileStore.service.js';
import { loadCredentials } from './credentialStore.service.js';

export type DoctorCheckStatus = 'pass' | 'warn' | 'fail';

export interface DoctorCheckResult {
  checkId: string;
  label: string;
  status: DoctorCheckStatus;
  message: string;
}

export interface RunDoctorChecksParams {
  profileName?: string;
  homeDirectory?: string;
  fetchImplementation?: typeof fetch;
}

export interface RunDoctorChecksResult {
  checks: DoctorCheckResult[];
  passed: boolean;
}

interface AppendDoctorCheckParams {
  checks: DoctorCheckResult[];
  checkId: string;
  label: string;
  status: DoctorCheckStatus;
  message: string;
}

function appendDoctorCheck(params: AppendDoctorCheckParams): void {
  params.checks.push({
    checkId: params.checkId,
    label: params.label,
    status: params.status,
    message: params.message,
  });
}

export async function runDoctorChecks(params: RunDoctorChecksParams = {}): Promise<RunDoctorChecksResult> {
  const { profileName, homeDirectory, fetchImplementation = fetch } = params;
  const checks: DoctorCheckResult[] = [];

  appendDoctorCheck({
    checks,
    checkId: 'cli_version',
    label: 'CLI version',
    status: 'pass',
    message: CLI_VERSION,
  });

  const credentialsFilePath = resolveCredentialsFilePath({ profileName, homeDirectory });
  let activeProfileName = profileName;
  if (!activeProfileName) {
    activeProfileName = await getActiveProfileName({ homeDirectory });
  }

  appendDoctorCheck({
    checks,
    checkId: 'active_profile',
    label: 'Active profile',
    status: 'pass',
    message: activeProfileName,
  });

  appendDoctorCheck({
    checks,
    checkId: 'credentials_path',
    label: 'Credentials file',
    status: 'pass',
    message: credentialsFilePath,
  });

  const credentials = await loadCredentials({ profileName, homeDirectory, configFilePath: credentialsFilePath });

  if (!credentials?.clientId || !credentials.clientSecret) {
    appendDoctorCheck({
      checks,
      checkId: 'partner_credentials',
      label: 'Partner app credentials',
      status: 'fail',
      message: 'Missing client ID or secret. Run `count init` or `count setup`.',
    });
  } else {
    appendDoctorCheck({
      checks,
      checkId: 'partner_credentials',
      label: 'Partner app credentials',
      status: 'pass',
      message: `Configured for ${credentials.apiBaseUrl}`,
    });
  }

  const redirectUri = `http://${DEFAULT_CALLBACK_HOST}:${DEFAULT_CALLBACK_PORT}${DEFAULT_CALLBACK_PATH}`;
  appendDoctorCheck({
    checks,
    checkId: 'redirect_uri',
    label: 'OAuth redirect URI',
    status: 'pass',
    message: `${redirectUri} (register at ${PARTNERS_PORTAL_URL})`,
  });

  appendDoctorCheck({
    checks,
    checkId: 'mcp_tools',
    label: 'MCP tool registry',
    status: 'pass',
    message: `${toolDefinitions.length} COUNT_* tools loaded`,
  });

  if (!credentials?.accessToken || !credentials.refreshToken) {
    appendDoctorCheck({
      checks,
      checkId: 'login_tokens',
      label: 'Workspace login',
      status: 'fail',
      message: 'Not logged in. Run `count login`.',
    });
  } else {
    const workspaceLabel = credentials.workspaceName ?? credentials.workspaceId ?? 'authenticated workspace';
    appendDoctorCheck({
      checks,
      checkId: 'login_tokens',
      label: 'Workspace login',
      status: 'pass',
      message: workspaceLabel,
    });
  }

  if (credentials?.clientId && credentials.clientSecret) {
    await appendApiConnectivityCheck({
      checks,
      credentials,
      fetchImplementation,
    });
  }

  appendDoctorCheck({
    checks,
    checkId: 'developer_docs',
    label: 'Partner API docs',
    status: 'pass',
    message: DEVELOPER_DOCS_URL,
  });

  const passed = checks.every((_check) => _check.status !== 'fail');
  return { checks, passed };
}

interface AppendApiConnectivityCheckParams {
  checks: DoctorCheckResult[];
  credentials: CountCliCredentials;
  fetchImplementation: typeof fetch;
}

async function appendApiConnectivityCheck(params: AppendApiConnectivityCheckParams): Promise<void> {
  const { checks, credentials, fetchImplementation } = params;

  try {
    const partnerClient = new PartnerApiClient({
      config: {
        apiBaseUrl: credentials.apiBaseUrl,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        requestTimeoutMs: credentials.requestTimeoutMs,
      },
      fetchImplementation,
    });

    if (credentials.accessToken && credentials.refreshToken) {
      await partnerClient.request({
        method: 'GET',
        path: '/partners/chart-of-accounts',
        query: { limit: 1 },
        requiresUserAuth: true,
      });

      appendDoctorCheck({
        checks,
        checkId: 'api_connectivity',
        label: 'COUNT API connectivity',
        status: 'pass',
        message: `Authenticated request succeeded against ${credentials.apiBaseUrl}`,
      });
      return;
    }

    const healthResponse = await fetchImplementation(credentials.apiBaseUrl, { method: 'HEAD' });
    if (healthResponse.ok || healthResponse.status === 404 || healthResponse.status === 405) {
      appendDoctorCheck({
        checks,
        checkId: 'api_connectivity',
        label: 'COUNT API connectivity',
        status: 'warn',
        message: `API host reachable at ${credentials.apiBaseUrl}. Run \`count login\` to verify workspace access.`,
      });
      return;
    }

    appendDoctorCheck({
      checks,
      checkId: 'api_connectivity',
      label: 'COUNT API connectivity',
      status: 'fail',
      message: `API host returned HTTP ${healthResponse.status} for ${credentials.apiBaseUrl}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    appendDoctorCheck({
      checks,
      checkId: 'api_connectivity',
      label: 'COUNT API connectivity',
      status: 'fail',
      message,
    });
  }
}

interface FormatDoctorReportParams {
  result: RunDoctorChecksResult;
}

export function formatDoctorReport(params: FormatDoctorReportParams): string {
  const statusSymbol: Record<DoctorCheckStatus, string> = {
    pass: '✓',
    warn: '!',
    fail: '✗',
  };

  const lines = params.result.checks.map((_check) => {
    return `${statusSymbol[_check.status]} ${_check.label}: ${_check.message}`;
  });

  lines.push('');
  lines.push(params.result.passed ? 'All required checks passed.' : 'One or more checks failed.');

  return `${lines.join('\n')}\n`;
}
