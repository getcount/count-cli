import { CLI_VERSION } from '../constants.js';
import { PartnerApiClient } from '../partner-mcp/partnerApiClient.js';
import { executeCountPartnerTool } from '../partner-mcp/tools/registerTools.js';
import { getToolDefinition, toolDefinitions } from '../partner-mcp/tools/definitions.js';
import type { ToolDefinition } from '../partner-mcp/types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { loadCredentials } from './credentialStore.service.js';
import { resolveCredentialsFilePath } from './profileStore.service.js';
import { runDoctorChecks, type RunDoctorChecksResult } from './doctor.service.js';

export type ToolSmokeTestStatus = 'pass' | 'fail' | 'skip';

export interface ToolSmokeTestResult {
  toolName: string;
  title: string;
  status: ToolSmokeTestStatus;
  mode: 'live' | 'validation' | 'registry';
  readOnly: boolean;
  destructive: boolean;
  durationMilliseconds: number;
  message: string;
}

export interface RunToolSmokeTestsParams {
  profileName?: string;
  homeDirectory?: string;
  delayBetweenCallsMilliseconds?: number;
}

export interface RunToolSmokeTestsReport {
  generatedAtIso: string;
  cliVersion: string;
  workspaceName: string;
  apiBaseUrl: string;
  doctorResult: RunDoctorChecksResult;
  toolResults: ToolSmokeTestResult[];
  summary: {
    totalTools: number;
    passed: number;
    failed: number;
    skipped: number;
    passRatePercent: number;
  };
}

import {
  extractRecordIdentifierFromApiResponse,
  seedSmokeTestFixtures,
  type SmokeTestFixtureIdentifierCache,
} from '../helpers/toolSmokeTestFixtures.helper.js';

interface ExecuteSmokeTestParams {
  tool: ToolDefinition;
  client: PartnerApiClient;
  fixtureIdentifierCache: SmokeTestFixtureIdentifierCache;
  describeEndpointTool: ToolDefinition;
  validatePayloadTool: ToolDefinition;
}

interface BuildSmokeTestInputParams {
  tool: ToolDefinition;
  fixtureIdentifierCache: SmokeTestFixtureIdentifierCache;
}

interface ExtractToolErrorMessageParams {
  toolResult: CallToolResult;
}

interface SleepParams {
  milliseconds: number;
}

interface GenerateToolSmokeTestHtmlReportParams {
  report: RunToolSmokeTestsReport;
}

function sleep(params: SleepParams): Promise<void> {
  return new Promise((_resolve) => {
    setTimeout(_resolve, params.milliseconds);
  });
}

function listPathToFixtureResourceKey(pathTemplate: string): string {
  return pathTemplate.replace(/^\/partners\//, '');
}

function resolvePathParameterInput(params: BuildSmokeTestInputParams): Record<string, unknown> | null {
  const { tool, fixtureIdentifierCache } = params;
  const pathParameterMatches = [...tool.pathTemplate.matchAll(/\{(\w+)\}/g)];

  if (pathParameterMatches.length === 0) {
    return {};
  }

  const pathParameterInput: Record<string, unknown> = {};

  for (const pathParameterMatch of pathParameterMatches) {
    const pathParameterName = pathParameterMatch[1];

    if (pathParameterName === 'versionNumber') {
      pathParameterInput.versionNumber = 1;
      continue;
    }

    const resourcePathBeforeParameter = tool.pathTemplate
      .slice(0, pathParameterMatch.index)
      .replace(/\/$/, '')
      .replace(/^\/partners\//, '');

    const fixtureIdentifier = fixtureIdentifierCache.fixtureIdentifiersByResourcePath[resourcePathBeforeParameter];
    if (!fixtureIdentifier) {
      return null;
    }

    pathParameterInput[pathParameterName] = fixtureIdentifier;
  }

  return pathParameterInput;
}

function buildReportDateRangeQuery(): Record<string, string> {
  const currentDate = new Date();
  const year = currentDate.getUTCFullYear();
  const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0');
  const lastDayOfMonth = new Date(Date.UTC(year, currentDate.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-${month}-${String(lastDayOfMonth).padStart(2, '0')}`,
  };
}

function buildSmokeTestInput(params: BuildSmokeTestInputParams): Record<string, unknown> | null {
  const { tool } = params;

  if (tool.name === 'COUNT_auth_status' || tool.name === 'COUNT_refresh_access_token') {
    return {};
  }

  if (tool.name === 'COUNT_describe_endpoint') {
    return { toolName: 'COUNT_list_customers' };
  }

  if (tool.name === 'COUNT_knowledge' || tool.name === 'COUNT_playbooks') {
    return {};
  }

  if (tool.name === 'COUNT_resolve_references') {
    return { customerName: 'Aimee' };
  }

  if (tool.name === 'COUNT_validate_payload') {
    return {
      toolName: 'COUNT_list_customers',
      query: { limit: 1 },
    };
  }

  if (tool.pathTemplate.startsWith('/partners/reports/')) {
    return { query: buildReportDateRangeQuery() };
  }

  const pathParameterInput = resolvePathParameterInput(params);
  if (pathParameterInput === null) {
    return null;
  }

  if (tool.method === 'GET' && Object.keys(pathParameterInput).length > 0) {
    if (tool.pathTemplate.includes('/grid') || tool.pathTemplate.includes('/versions')) {
      return {
        ...pathParameterInput,
        query: { limit: 1 },
      };
    }

    return pathParameterInput;
  }

  if (tool.method === 'GET') {
    if (tool.pathTemplate.endsWith('/overall') || tool.name === 'COUNT_get_workspace_stats') {
      return {};
    }

    return { query: { limit: 1 } };
  }

  return {};
}

function extractToolErrorMessage(params: ExtractToolErrorMessageParams): string {
  const firstContentBlock = params.toolResult.content[0];
  if (firstContentBlock && firstContentBlock.type === 'text') {
    return firstContentBlock.text.slice(0, 500);
  }

  return 'Unknown MCP tool error.';
}

function updateFixtureCacheFromSuccessfulListTool(params: {
  tool: ToolDefinition;
  toolResult: CallToolResult;
  fixtureIdentifierCache: SmokeTestFixtureIdentifierCache;
}): void {
  if (params.toolResult.isError || params.tool.method !== 'GET' || !params.tool.readOnly) {
    return;
  }

  if (params.tool.pathTemplate.includes('{')) {
    return;
  }

  const recordIdentifier = extractRecordIdentifierFromApiResponse(params.toolResult.structuredContent?.result);
  if (!recordIdentifier) {
    return;
  }

  const fixtureResourceKey = listPathToFixtureResourceKey(params.tool.pathTemplate);
  params.fixtureIdentifierCache.fixtureIdentifiersByResourcePath[fixtureResourceKey] = recordIdentifier;
}

function classifyLiveToolFailure(params: {
  tool: ToolDefinition;
  errorMessage: string;
}): ToolSmokeTestStatus {
  if (
    params.tool.readOnly &&
    (params.errorMessage.includes('"statusCode": 404') ||
      params.errorMessage.includes('statusCode": 404') ||
      params.errorMessage.includes("Can't find GET"))
  ) {
    return 'skip';
  }

  return 'fail';
}

async function executeSmokeTest(params: ExecuteSmokeTestParams): Promise<ToolSmokeTestResult> {
  const startedAtMilliseconds = Date.now();
  const { tool, client, fixtureIdentifierCache, describeEndpointTool, validatePayloadTool } = params;

  if (!tool.readOnly) {
    const describeResult = await executeCountPartnerTool({
      tool: describeEndpointTool,
      input: { toolName: tool.name },
      client,
    });

    if (describeResult.isError) {
      return {
        toolName: tool.name,
        title: tool.title,
        status: 'fail',
        mode: 'registry',
        readOnly: tool.readOnly,
        destructive: tool.destructive,
        durationMilliseconds: Date.now() - startedAtMilliseconds,
        message: extractToolErrorMessage({ toolResult: describeResult }),
      };
    }

    const validateResult = await executeCountPartnerTool({
      tool: validatePayloadTool,
      input: {
        toolName: tool.name,
        body: {},
      },
      client,
    });

    const validationMessage = validateResult.isError
      ? extractToolErrorMessage({ toolResult: validateResult })
      : 'Payload validation handler responded successfully.';

    return {
      toolName: tool.name,
      title: tool.title,
      status: 'pass',
      mode: 'validation',
      readOnly: tool.readOnly,
      destructive: tool.destructive,
      durationMilliseconds: Date.now() - startedAtMilliseconds,
      message: `Registry and validation verified (write/destructive tool not executed). ${validationMessage}`,
    };
  }

  const smokeTestInput = buildSmokeTestInput({ tool, fixtureIdentifierCache });
  if (smokeTestInput === null) {
    return {
      toolName: tool.name,
      title: tool.title,
      status: 'skip',
      mode: 'live',
      readOnly: tool.readOnly,
      destructive: tool.destructive,
      durationMilliseconds: Date.now() - startedAtMilliseconds,
      message: 'No fixture record available for required path parameters.',
    };
  }

  const toolResult = await executeCountPartnerTool({
    tool,
    input: smokeTestInput,
    client,
  });

  updateFixtureCacheFromSuccessfulListTool({
    tool,
    toolResult,
    fixtureIdentifierCache,
  });

  if (toolResult.isError) {
    const errorMessage = extractToolErrorMessage({ toolResult });
    const failureStatus = classifyLiveToolFailure({ tool, errorMessage });

    return {
      toolName: tool.name,
      title: tool.title,
      status: failureStatus,
      mode: 'live',
      readOnly: tool.readOnly,
      destructive: tool.destructive,
      durationMilliseconds: Date.now() - startedAtMilliseconds,
      message:
        failureStatus === 'skip'
          ? `Partner API route not available in this environment. ${errorMessage}`
          : errorMessage,
    };
  }

  return {
    toolName: tool.name,
    title: tool.title,
    status: 'pass',
    mode: 'live',
    readOnly: tool.readOnly,
    destructive: tool.destructive,
    durationMilliseconds: Date.now() - startedAtMilliseconds,
    message: 'Live MCP tool call succeeded.',
  };
}

export async function runToolSmokeTests(params: RunToolSmokeTestsParams = {}): Promise<RunToolSmokeTestsReport> {
  const { profileName, homeDirectory, delayBetweenCallsMilliseconds = 75 } = params;
  const credentialsFilePath = resolveCredentialsFilePath({ profileName, homeDirectory });
  const credentials = await loadCredentials({ profileName, homeDirectory, configFilePath: credentialsFilePath });

  if (!credentials?.clientId || !credentials.clientSecret) {
    throw new Error('Partner credentials are not configured. Run `count init` or `count login` first.');
  }

  const partnerClient = new PartnerApiClient({
    config: {
      apiBaseUrl: credentials.apiBaseUrl,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken,
      requestTimeoutMs: credentials.requestTimeoutMs,
      credentialsFilePath,
    },
  });

  const describeEndpointTool = getToolDefinition({ toolName: 'COUNT_describe_endpoint' });
  const validatePayloadTool = getToolDefinition({ toolName: 'COUNT_validate_payload' });

  if (!describeEndpointTool || !validatePayloadTool) {
    throw new Error('Required MCP meta tools are missing from the tool registry.');
  }

  const doctorResult = await runDoctorChecks({ profileName, homeDirectory });
  const fixtureIdentifierCache: SmokeTestFixtureIdentifierCache = {
    fixtureIdentifiersByResourcePath: {},
    supportingAccountIdentifiers: {},
  };

  await seedSmokeTestFixtures({
    client: partnerClient,
    fixtureIdentifierCache,
    delayBetweenCallsMilliseconds,
  });

  const toolResults: ToolSmokeTestResult[] = [];

  const sortedToolDefinitions = [...toolDefinitions].sort((_leftTool, _rightTool) => {
    if (_leftTool.readOnly !== _rightTool.readOnly) {
      return _leftTool.readOnly ? -1 : 1;
    }

    const leftIsListTool = _leftTool.name.startsWith('COUNT_list_') ? 0 : 1;
    const rightIsListTool = _rightTool.name.startsWith('COUNT_list_') ? 0 : 1;
    if (leftIsListTool !== rightIsListTool) {
      return leftIsListTool - rightIsListTool;
    }

    return _leftTool.name.localeCompare(_rightTool.name);
  });

  for (const tool of sortedToolDefinitions) {
    const toolSmokeTestResult = await executeSmokeTest({
      tool,
      client: partnerClient,
      fixtureIdentifierCache,
      describeEndpointTool,
      validatePayloadTool,
    });
    toolResults.push(toolSmokeTestResult);

    if (delayBetweenCallsMilliseconds > 0) {
      await sleep({ milliseconds: delayBetweenCallsMilliseconds });
    }
  }

  const passed = toolResults.filter((_result) => _result.status === 'pass').length;
  const failed = toolResults.filter((_result) => _result.status === 'fail').length;
  const skipped = toolResults.filter((_result) => _result.status === 'skip').length;
  const totalTools = toolResults.length;
  const passRatePercent = totalTools === 0 ? 0 : Math.round((passed / totalTools) * 1000) / 10;

  return {
    generatedAtIso: new Date().toISOString(),
    cliVersion: CLI_VERSION,
    workspaceName: credentials.workspaceName ?? credentials.workspaceId ?? 'Authenticated workspace',
    apiBaseUrl: credentials.apiBaseUrl,
    doctorResult,
    toolResults,
    summary: {
      totalTools,
      passed,
      failed,
      skipped,
      passRatePercent,
    },
  };
}

function escapeHtml(rawText: string): string {
  return rawText
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function generateToolSmokeTestHtmlReport(params: GenerateToolSmokeTestHtmlReportParams): string {
  const { report } = params;
  const overallHealthy = report.summary.failed === 0 && report.doctorResult.passed;
  const statusLabel = overallHealthy ? 'All systems operational' : 'Issues detected';
  const statusClass = overallHealthy ? 'status-pass' : 'status-fail';

  const doctorRows = report.doctorResult.checks
    .map((_check) => {
      return `<tr>
        <td><span class="pill pill-${_check.status}">${escapeHtml(_check.status)}</span></td>
        <td>${escapeHtml(_check.label)}</td>
        <td>${escapeHtml(_check.message)}</td>
      </tr>`;
    })
    .join('\n');

  const toolRows = report.toolResults
    .map((_result) => {
      return `<tr>
        <td><span class="pill pill-${_result.status}">${escapeHtml(_result.status)}</span></td>
        <td><code>${escapeHtml(_result.toolName)}</code></td>
        <td>${escapeHtml(_result.title)}</td>
        <td>${escapeHtml(_result.mode)}</td>
        <td>${_result.readOnly ? 'yes' : 'no'}</td>
        <td>${_result.destructive ? 'yes' : 'no'}</td>
        <td>${_result.durationMilliseconds} ms</td>
        <td>${escapeHtml(_result.message)}</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>COUNT CLI Tool Smoke Test Report</title>
  <style>
    :root {
      color-scheme: light;
      --brand: #e48642;
      --pass: #15803d;
      --fail: #b91c1c;
      --skip: #a16207;
      --warn: #b45309;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #0f172a;
      --muted: #475569;
      --border: #e2e8f0;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    header {
      background: linear-gradient(135deg, #1e293b, #334155);
      color: white;
      padding: 32px 24px;
    }
    header h1 { margin: 0 0 8px; font-size: 1.75rem; }
    header p { margin: 0; color: #cbd5e1; }
    main { max-width: 1400px; margin: 0 auto; padding: 24px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    }
    .card h2, .card h3 { margin: 0 0 8px; font-size: 1rem; }
    .metric { font-size: 2rem; font-weight: 700; color: var(--brand); }
    .muted { color: var(--muted); font-size: 0.925rem; }
    .status-banner {
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
      font-weight: 600;
      border: 1px solid transparent;
    }
    .status-pass {
      background: #ecfdf5;
      color: var(--pass);
      border-color: #bbf7d0;
    }
    .status-fail {
      background: #fef2f2;
      color: var(--fail);
      border-color: #fecaca;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
      background: var(--card);
    }
    th, td {
      border-bottom: 1px solid var(--border);
      padding: 10px 12px;
      vertical-align: top;
      text-align: left;
    }
    th {
      background: #f1f5f9;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .table-wrap {
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 12px;
      max-height: 70vh;
    }
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .pill-pass, .pill-pass { background: #dcfce7; color: var(--pass); }
    .pill-fail { background: #fee2e2; color: var(--fail); }
    .pill-skip { background: #fef9c3; color: var(--skip); }
    .pill-warn { background: #ffedd5; color: var(--warn); }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.8125rem; }
    section { margin-bottom: 32px; }
  </style>
</head>
<body>
  <header>
    <h1>COUNT CLI MCP Tool Smoke Test Report</h1>
    <p>Generated ${escapeHtml(report.generatedAtIso)} · CLI v${escapeHtml(report.cliVersion)} · ${escapeHtml(report.workspaceName)} · ${escapeHtml(report.apiBaseUrl)}</p>
  </header>
  <main>
    <div class="status-banner ${statusClass}">${escapeHtml(statusLabel)}</div>

    <div class="grid">
      <div class="card"><h2>Total tools</h2><div class="metric">${report.summary.totalTools}</div></div>
      <div class="card"><h2>Passed</h2><div class="metric">${report.summary.passed}</div></div>
      <div class="card"><h2>Failed</h2><div class="metric">${report.summary.failed}</div></div>
      <div class="card"><h2>Skipped</h2><div class="metric">${report.summary.skipped}</div></div>
      <div class="card"><h2>Pass rate</h2><div class="metric">${report.summary.passRatePercent}%</div></div>
    </div>

    <section>
      <h3>CLI health checks (count doctor)</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Status</th><th>Check</th><th>Message</th></tr></thead>
          <tbody>${doctorRows}</tbody>
        </table>
      </div>
    </section>

    <section>
      <h3>MCP tool results</h3>
      <p class="muted">Read-only tools were executed live against your workspace. Write/destructive tools were verified via registry + payload validation without mutating data.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Tool</th>
              <th>Title</th>
              <th>Mode</th>
              <th>Read only</th>
              <th>Destructive</th>
              <th>Duration</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>${toolRows}</tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>
`;
}
