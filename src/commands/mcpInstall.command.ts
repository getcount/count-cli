import {
  formatInstallMcpReport,
  installMcpConfiguration,
  type McpInstallTarget,
} from '../services/mcpInstall.service.js';

interface RunMcpInstallCommandParams {
  target: McpInstallTarget;
  dryRun?: boolean;
}

export async function runMcpInstallCommand(params: RunMcpInstallCommandParams): Promise<void> {
  const installationResults = await installMcpConfiguration({
    target: params.target,
    dryRun: params.dryRun,
  });

  process.stdout.write(formatInstallMcpReport({ installationResults }));
}
