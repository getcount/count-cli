import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergeCountMcpServerConfig } from '../services/mcpInstall.service.js';

describe('mcpInstall', () => {
  it('merges the COUNT MCP server without removing other servers', () => {
    const mergedConfiguration = mergeCountMcpServerConfig({
      existingConfiguration: {
        mcpServers: {
          other: {
            command: 'node',
            args: ['other-server.js'],
          },
        },
      },
      countServerConfiguration: {
        command: '/usr/local/bin/node',
        args: ['/path/to/count-cli/dist/index.js', 'mcp'],
      },
    });

    const mcpServers = mergedConfiguration.mcpServers as Record<string, Record<string, unknown>>;
    assert.deepEqual(mcpServers.other.args, ['other-server.js']);
    assert.deepEqual(mcpServers.count.args, ['/path/to/count-cli/dist/index.js', 'mcp']);
  });
});
