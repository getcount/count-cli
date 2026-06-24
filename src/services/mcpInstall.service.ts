import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildClaudeCodeMcpConfig } from './mcpLauncher.service.js';

export function resolveCursorMcpConfigPath(params: { homeDirectory?: string } = {}): string {
  return path.join(params.homeDirectory ?? os.homedir(), '.cursor', 'mcp.json');
}

export function resolveClaudeCodeSettingsPath(params: { homeDirectory?: string } = {}): string {
  return path.join(params.homeDirectory ?? os.homedir(), '.claude', 'settings.json');
}

export function resolveClaudeDesktopConfigPath(params: { homeDirectory?: string } = {}): string {
  const homeDirectory = params.homeDirectory ?? os.homedir();

  if (process.platform === 'darwin') {
    return path.join(homeDirectory, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }

  if (process.platform === 'win32') {
    const applicationDataDirectory = process.env.APPDATA ?? path.join(homeDirectory, 'AppData', 'Roaming');
    return path.join(applicationDataDirectory, 'Claude', 'claude_desktop_config.json');
  }

  return path.join(homeDirectory, '.config', 'Claude', 'claude_desktop_config.json');
}

export type McpInstallTarget = 'cursor' | 'claude-code' | 'claude-desktop' | 'all';

export interface McpInstallTargetDefinition {
  targetId: McpInstallTarget;
  label: string;
  configFilePath: string;
}

interface ResolveMcpInstallTargetsParams {
  target: McpInstallTarget;
  homeDirectory?: string;
}

export function resolveMcpInstallTargets(params: ResolveMcpInstallTargetsParams): McpInstallTargetDefinition[] {
  const { target, homeDirectory } = params;
  const allTargets: McpInstallTargetDefinition[] = [
    {
      targetId: 'cursor',
      label: 'Cursor',
      configFilePath: resolveCursorMcpConfigPath({ homeDirectory }),
    },
    {
      targetId: 'claude-code',
      label: 'Claude Code',
      configFilePath: resolveClaudeCodeSettingsPath({ homeDirectory }),
    },
    {
      targetId: 'claude-desktop',
      label: 'Claude Desktop',
      configFilePath: resolveClaudeDesktopConfigPath({ homeDirectory }),
    },
  ];

  if (target === 'all') {
    return allTargets;
  }

  const matchingTarget = allTargets.find((_entry) => _entry.targetId === target);
  if (!matchingTarget) {
    throw new Error(`Unsupported MCP install target "${target}".`);
  }

  return [matchingTarget];
}

interface ReadJsonFileParams {
  filePath: string;
}

async function readJsonFile(params: ReadJsonFileParams): Promise<Record<string, unknown>> {
  try {
    const rawContents = await fs.readFile(params.filePath, 'utf8');
    const parsedJson = JSON.parse(rawContents) as unknown;
    if (!parsedJson || typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
      return {};
    }

    return parsedJson as Record<string, unknown>;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

interface MergeCountMcpServerConfigParams {
  existingConfiguration: Record<string, unknown>;
  countServerConfiguration: Record<string, unknown>;
}

export function mergeCountMcpServerConfig(params: MergeCountMcpServerConfigParams): Record<string, unknown> {
  const existingMcpServers =
    params.existingConfiguration.mcpServers && typeof params.existingConfiguration.mcpServers === 'object'
      ? (params.existingConfiguration.mcpServers as Record<string, unknown>)
      : {};

  return {
    ...params.existingConfiguration,
    mcpServers: {
      ...existingMcpServers,
      count: params.countServerConfiguration,
    },
  };
}

export interface InstallMcpConfigurationParams {
  target: McpInstallTarget;
  homeDirectory?: string;
  dryRun?: boolean;
}

export interface InstallMcpConfigurationResult {
  targetId: McpInstallTarget;
  label: string;
  configFilePath: string;
  dryRun: boolean;
  mergedConfiguration: Record<string, unknown>;
}

export async function installMcpConfiguration(
  params: InstallMcpConfigurationParams,
): Promise<InstallMcpConfigurationResult[]> {
  const { target, homeDirectory, dryRun = false } = params;
  const installTargets = resolveMcpInstallTargets({ target, homeDirectory });
  const countMcpConfiguration = buildClaudeCodeMcpConfig();
  const countServerConfiguration = (countMcpConfiguration.mcpServers as Record<string, Record<string, unknown>>).count;
  const installationResults: InstallMcpConfigurationResult[] = [];

  for (const installTarget of installTargets) {
    const existingConfiguration = await readJsonFile({ filePath: installTarget.configFilePath });
    const mergedConfiguration = mergeCountMcpServerConfig({
      existingConfiguration,
      countServerConfiguration,
    });

    if (!dryRun) {
      await fs.mkdir(path.dirname(installTarget.configFilePath), { recursive: true });
      await fs.writeFile(installTarget.configFilePath, `${JSON.stringify(mergedConfiguration, null, 2)}\n`, {
        encoding: 'utf8',
      });
    }

    installationResults.push({
      targetId: installTarget.targetId,
      label: installTarget.label,
      configFilePath: installTarget.configFilePath,
      dryRun,
      mergedConfiguration,
    });
  }

  return installationResults;
}

interface FormatInstallMcpReportParams {
  installationResults: InstallMcpConfigurationResult[];
}

export function formatInstallMcpReport(params: FormatInstallMcpReportParams): string {
  const lines: string[] = [];

  for (const installationResult of params.installationResults) {
    const actionLabel = installationResult.dryRun ? 'Would install MCP config for' : 'Installed MCP config for';
    lines.push(`${actionLabel} ${installationResult.label}`);
    lines.push(`  ${installationResult.configFilePath}`);
  }

  lines.push('');
  lines.push('Restart your editor or reload MCP servers to pick up the change.');

  return `${lines.join('\n')}\n`;
}
