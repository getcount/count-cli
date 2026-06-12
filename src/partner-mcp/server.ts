import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CLI_VERSION } from '../constants.js';
import { PartnerApiClient } from './partnerApiClient.js';
import { registerResources } from './resources/registerResources.js';
import { registerTools } from './tools/registerTools.js';
import type { CountPartnerMcpConfig } from './types.js';

interface CreateServerParams {
  config: CountPartnerMcpConfig;
}

export function createServer(params: CreateServerParams): McpServer {
  const { config } = params;
  const server = new McpServer({
    name: '@countfinancial/cli',
    version: CLI_VERSION,
  });
  const client = new PartnerApiClient({ config });

  registerTools({ server, client });
  registerResources({ server, client });

  return server;
}

