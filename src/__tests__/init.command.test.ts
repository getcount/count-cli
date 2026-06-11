import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { runInitCommand } from '../commands/init.command.js';
import { getConfigFilePath, loadCredentials, saveCredentials } from '../services/credentialStore.service.js';

describe('runInitCommand', () => {
  it('preserves existing api URL and login tokens when re-initializing credentials', async () => {
    const temporaryHomeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'count-cli-init-home-'));
    const configFilePath = getConfigFilePath({ homeDirectory: temporaryHomeDirectory });

    await saveCredentials({
      configFilePath,
      credentials: {
        apiBaseUrl: 'https://dev-api.getcount.com',
        clientId: 'old-client-id',
        clientSecret: 'old-client-secret',
        accessToken: 'stored-access-token',
        refreshToken: 'stored-refresh-token',
        workspaceId: 'workspace-uuid',
        workspaceName: 'Demo Workspace',
        requestTimeoutMs: 30000,
      },
    });

    await runInitCommand({
      clientId: 'new-client-id',
      clientSecret: 'new-client-secret',
      configFilePath,
    });

    const reloadedCredentials = await loadCredentials({ configFilePath });

    assert.equal(reloadedCredentials?.apiBaseUrl, 'https://dev-api.getcount.com');
    assert.equal(reloadedCredentials?.clientId, 'new-client-id');
    assert.equal(reloadedCredentials?.clientSecret, 'new-client-secret');
    assert.equal(reloadedCredentials?.accessToken, 'stored-access-token');
    assert.equal(reloadedCredentials?.refreshToken, 'stored-refresh-token');
    assert.equal(reloadedCredentials?.workspaceId, 'workspace-uuid');
    assert.equal(reloadedCredentials?.workspaceName, 'Demo Workspace');
  });

  it('clears login tokens when the API URL changes', async () => {
    const temporaryHomeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'count-cli-init-home-'));
    const configFilePath = getConfigFilePath({ homeDirectory: temporaryHomeDirectory });

    await saveCredentials({
      configFilePath,
      credentials: {
        apiBaseUrl: 'https://api.getcount.com',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        accessToken: 'stored-access-token',
        refreshToken: 'stored-refresh-token',
        workspaceId: 'workspace-uuid',
        workspaceName: 'Demo Workspace',
        requestTimeoutMs: 30000,
      },
    });

    await runInitCommand({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      apiBaseUrl: 'https://dev-api.getcount.com',
      configFilePath,
    });

    const reloadedCredentials = await loadCredentials({ configFilePath });

    assert.equal(reloadedCredentials?.apiBaseUrl, 'https://dev-api.getcount.com');
    assert.equal(reloadedCredentials?.accessToken, undefined);
    assert.equal(reloadedCredentials?.refreshToken, undefined);
    assert.equal(reloadedCredentials?.workspaceId, undefined);
    assert.equal(reloadedCredentials?.workspaceName, undefined);
  });
});
