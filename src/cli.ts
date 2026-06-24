import { Command } from 'commander';
import { runInitCommand } from './commands/init.command.js';
import { runLoginCommand } from './commands/login.command.js';
import { runLogoutCommand } from './commands/logout.command.js';
import { runDoctorCommand } from './commands/doctor.command.js';
import { runMcpInstallCommand } from './commands/mcpInstall.command.js';
import { runMcpPrintConfigCommand, runMcpStartCommand } from './commands/mcp.command.js';
import {
  runProfilesAddCommand,
  runProfilesListCommand,
  runProfilesUseCommand,
} from './commands/profiles.command.js';
import { runSetupCommand } from './commands/setup.command.js';
import { runStatusCommand } from './commands/status.command.js';
import type { McpInstallTarget } from './services/mcpInstall.service.js';

interface CreateCliParams {
  version: string;
}

interface GlobalCommandOptions {
  profile?: string;
  json?: boolean;
}

function readGlobalOptions(command: Command): GlobalCommandOptions {
  let rootCommand = command;
  while (rootCommand.parent) {
    rootCommand = rootCommand.parent;
  }

  return rootCommand.opts() as GlobalCommandOptions;
}

export function createCli(params: CreateCliParams): Command {
  const program = new Command();

  program
    .name('count')
    .description('COUNT Partner CLI — OAuth login and local MCP for Claude Code, Cursor, and agents.')
    .version(params.version)
    .option('--profile <profileName>', 'Named credential profile under ~/.count/profiles/')
    .option('--json', 'Emit machine-readable JSON output where supported');

  program
    .command('setup')
    .description('Interactive setup wizard: credentials, login, MCP install, and health checks')
    .option('--profile <profileName>', 'Profile name to create or update', 'default')
    .option('--client-id <clientId>', 'Partner client ID (non-interactive mode)')
    .option('--client-secret <clientSecret>', 'Partner client secret (non-interactive mode)')
    .option('--api-url <apiUrl>', 'COUNT API base URL')
    .option('--skip-login', 'Skip browser OAuth login')
    .option('--skip-install', 'Skip MCP editor config install')
    .option('--non-interactive', 'Run without prompts (requires client credentials flags when needed)')
    .action(async (options, command) => {
      const globalOptions = readGlobalOptions(command);
      const exitCode = await runSetupCommand({
        profileName: options.profile ?? globalOptions.profile,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        apiBaseUrl: options.apiUrl,
        skipLogin: options.skipLogin,
        skipInstall: options.skipInstall,
        nonInteractive: options.nonInteractive,
      });
      process.exit(exitCode);
    });

  program
    .command('doctor')
    .description('Run COUNT CLI and API health checks')
    .action(async (_options, command) => {
      const globalOptions = readGlobalOptions(command);
      const exitCode = await runDoctorCommand({
        profileName: globalOptions.profile,
        json: globalOptions.json,
      });
      process.exit(exitCode);
    });

  program
    .command('init')
    .description('Save partner client credentials from COUNT Partners')
    .requiredOption('--client-id <clientId>', 'Partner client ID')
    .requiredOption('--client-secret <clientSecret>', 'Partner client secret')
    .option('--api-url <apiUrl>', 'COUNT API base URL (default: prod, or keep existing saved URL)')
    .action(async (options, command) => {
      const globalOptions = readGlobalOptions(command);
      await runInitCommand({
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        apiBaseUrl: options.apiUrl,
        profileName: globalOptions.profile,
      });
    });

  program
    .command('login')
    .description('Sign in through COUNT partner OAuth and store workspace tokens')
    .option('--port <port>', 'Local OAuth callback port', (value) => Number.parseInt(value, 10))
    .option('--no-open', 'Print the sign-in URL instead of opening a browser')
    .action(async (options, command) => {
      const globalOptions = readGlobalOptions(command);
      await runLoginCommand({
        callbackPort: options.port,
        openBrowserAutomatically: options.open,
        profileName: globalOptions.profile,
      });
    });

  program.command('logout').description('Remove stored COUNT CLI credentials').action(async (_options, command) => {
    const globalOptions = readGlobalOptions(command);
    await runLogoutCommand({ profileName: globalOptions.profile });
  });

  program.command('status').description('Show stored credential state').action(async (_options, command) => {
    const globalOptions = readGlobalOptions(command);
    await runStatusCommand({
      profileName: globalOptions.profile,
      json: globalOptions.json,
    });
  });

  const profilesCommand = program.command('profiles').description('Manage named credential profiles');

  profilesCommand
    .command('list')
    .description('List saved credential profiles')
    .action(async (_options, command) => {
      const globalOptions = readGlobalOptions(command);
      await runProfilesListCommand({
        profileName: globalOptions.profile,
        json: globalOptions.json,
      });
    });

  profilesCommand
    .command('add <profileName>')
    .description('Create a profile and save partner client credentials')
    .requiredOption('--client-id <clientId>', 'Partner client ID')
    .requiredOption('--client-secret <clientSecret>', 'Partner client secret')
    .option('--api-url <apiUrl>', 'COUNT API base URL')
    .action(async (profileName: string, options) => {
      await runProfilesAddCommand({
        profileName,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        apiBaseUrl: options.apiUrl,
      });
    });

  profilesCommand
    .command('use <profileName>')
    .description('Switch the active credential profile')
    .action(async (profileName: string) => {
      await runProfilesUseCommand({ profileName });
    });

  const mcpCommand = program.command('mcp').description('Local COUNT Partner MCP server');

  mcpCommand
    .command('start', { isDefault: true })
    .description('Start the stdio MCP server using stored credentials')
    .action(async (_options, command) => {
      const globalOptions = readGlobalOptions(command);
      await runMcpStartCommand({ profileName: globalOptions.profile });
    });

  mcpCommand
    .command('print-config')
    .description('Print Claude Code / Cursor MCP configuration JSON')
    .action(async () => {
      await runMcpPrintConfigCommand();
    });

  mcpCommand
    .command('install')
    .description('Install COUNT MCP config into Cursor or Claude settings')
    .option('--target <target>', 'Install target: cursor, claude-code, claude-desktop, or all', 'cursor')
    .option('--dry-run', 'Show what would be written without modifying files')
    .action(async (options) => {
      await runMcpInstallCommand({
        target: options.target as McpInstallTarget,
        dryRun: Boolean(options.dryRun),
      });
    });

  return program;
}
