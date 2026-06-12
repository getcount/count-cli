import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { buildClaudeCodeMcpConfig, resolveCliEntryPath } from '../services/mcpLauncher.service.js';
import * as tokenPersistence from '../partner-mcp/tokenPersistence.js';

describe('mcpLauncher', () => {
  it('builds MCP config that delegates to the CLI without embedding secrets', () => {
    const configuration = buildClaudeCodeMcpConfig();
    const countServerConfiguration = (configuration.mcpServers as Record<string, Record<string, unknown>>).count;

    assert.equal(countServerConfiguration.command, process.execPath);
    assert.deepEqual(countServerConfiguration.args, [resolveCliEntryPath(), 'mcp']);
    assert.equal(countServerConfiguration.env, undefined);
  });
});

describe('tokenPersistence', () => {
  it('updates access and refresh tokens in the credentials file', async () => {
    const temporaryHomeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'count-cli-token-home-'));
    const credentialsFilePath = path.join(temporaryHomeDirectory, 'credentials.json');
    await fs.writeFile(
      credentialsFilePath,
      `${JSON.stringify(
        {
          apiBaseUrl: 'https://api.getcount.com',
          clientId: 'client-id',
          clientSecret: 'client-secret',
          accessToken: 'old-access-token',
          refreshToken: 'old-refresh-token',
          requestTimeoutMs: 30000,
        },
        null,
        2,
      )}\n`,
      { encoding: 'utf8', mode: 0o600 },
    );

    await tokenPersistence.persistRefreshedTokens({
      credentialsFilePath,
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });

    const reloadedCredentials = JSON.parse(await fs.readFile(credentialsFilePath, 'utf8')) as {
      accessToken: string;
      refreshToken: string;
      clientId: string;
    };

    assert.equal(reloadedCredentials.accessToken, 'new-access-token');
    assert.equal(reloadedCredentials.refreshToken, 'new-refresh-token');
    assert.equal(reloadedCredentials.clientId, 'client-id');
  });
});
