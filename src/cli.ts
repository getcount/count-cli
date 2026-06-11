import { Command } from 'commander';
import { runInitCommand } from './commands/init.command.js';
import { runLoginCommand } from './commands/login.command.js';
import { runLogoutCommand } from './commands/logout.command.js';
import { runMcpPrintConfigCommand, runMcpStartCommand } from './commands/mcp.command.js';
import { runStatusCommand } from './commands/status.command.js';
interface CreateCliParams {
  version: string;
}

export function createCli(params: CreateCliParams): Command {
  const program = new Command();

  program
    .name('count')
    .description('COUNT Partner CLI — OAuth login and local MCP for Claude Code, Cursor, and agents.')
    .version(params.version);

  program
    .command('init')
    .description('Save partner client credentials from COUNT Partners')
    .requiredOption('--client-id <clientId>', 'Partner client ID')
    .requiredOption('--client-secret <clientSecret>', 'Partner client secret')
    .option('--api-url <apiUrl>', 'COUNT API base URL (default: prod, or keep existing saved URL)')
    .action(async (options: { clientId: string; clientSecret: string; apiUrl?: string }) => {
      await runInitCommand({
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        apiBaseUrl: options.apiUrl,
      });
    });

  program
    .command('login')
    .description('Sign in through COUNT partner OAuth and store workspace tokens')
    .option('--port <port>', 'Local OAuth callback port', (value) => Number.parseInt(value, 10))
    .option('--no-open', 'Print the sign-in URL instead of opening a browser')
    .action(async (options: { port?: number; open: boolean }) => {
      await runLoginCommand({
        callbackPort: options.port,
        openBrowserAutomatically: options.open,
      });
    });

  program.command('logout').description('Remove stored COUNT CLI credentials').action(async () => {
    await runLogoutCommand();
  });

  program.command('status').description('Show stored credential state').action(async () => {
    await runStatusCommand();
  });

  const mcpCommand = program.command('mcp').description('Local COUNT Partner MCP server');

  mcpCommand
    .command('start', { isDefault: true })
    .description('Start the stdio MCP server using stored credentials')
    .action(async () => {
      await runMcpStartCommand();
    });

  mcpCommand
    .command('print-config')
    .description('Print Claude Code / Cursor MCP configuration JSON')
    .action(async () => {
      await runMcpPrintConfigCommand();
    });

  return program;
}
