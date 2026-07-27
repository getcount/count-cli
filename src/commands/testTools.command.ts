import fs from 'node:fs/promises';
import path from 'node:path';
import {
  generateToolSmokeTestHtmlReport,
  runToolSmokeTests,
  type RunToolSmokeTestsReport,
} from '../services/toolSmokeTest.service.js';

interface RunTestToolsCommandParams {
  profileName?: string;
  htmlOutputPath?: string;
  json?: boolean;
}

function formatTextSummary(params: { report: RunToolSmokeTestsReport; htmlOutputPath?: string }): string {
  const lines = [
    `COUNT CLI tool smoke test complete.`,
    `Workspace: ${params.report.workspaceName}`,
    `Tools: ${params.report.summary.totalTools} total · ${params.report.summary.passed} passed · ${params.report.summary.failed} failed · ${params.report.summary.skipped} skipped`,
    `Pass rate: ${params.report.summary.passRatePercent}%`,
  ];

  if (params.htmlOutputPath) {
    lines.push(`HTML report: ${params.htmlOutputPath}`);
  }

  if (params.report.summary.failed > 0) {
    lines.push('');
    lines.push('Failed tools:');
    for (const toolResult of params.report.toolResults) {
      if (toolResult.status === 'fail') {
        lines.push(`  - ${toolResult.toolName}: ${toolResult.message}`);
      }
    }
  }

  lines.push('');
  lines.push(params.report.summary.failed === 0 ? 'All tool checks passed.' : 'One or more tool checks failed.');

  return `${lines.join('\n')}\n`;
}

export async function runTestToolsCommand(params: RunTestToolsCommandParams = {}): Promise<number> {
  const report = await runToolSmokeTests({ profileName: params.profileName });
  const resolvedHtmlOutputPath = params.htmlOutputPath
    ? path.resolve(params.htmlOutputPath)
    : path.resolve(process.cwd(), 'count-cli-test-report.html');

  const htmlReport = generateToolSmokeTestHtmlReport({ report });
  await fs.writeFile(resolvedHtmlOutputPath, htmlReport, 'utf8');

  if (params.json) {
    process.stdout.write(`${JSON.stringify({ ...report, htmlOutputPath: resolvedHtmlOutputPath }, null, 2)}\n`);
  } else {
    process.stdout.write(formatTextSummary({ report, htmlOutputPath: resolvedHtmlOutputPath }));
  }

  return report.summary.failed === 0 && report.doctorResult.passed ? 0 : 1;
}
