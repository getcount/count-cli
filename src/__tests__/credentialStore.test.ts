import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  buildDefaultCredentials,
  deleteCredentials,
  getConfigFilePath,
  loadCredentials,
  saveCredentials,
} from '../services/credentialStore.service.js';
import { DEFAULT_API_BASE_URL } from '../constants.js';

describe('credentialStore', () => {
  it('defaults to the production API host when no api URL is provided', () => {
    const credentials = buildDefaultCredentials({
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });

    assert.equal(credentials.apiBaseUrl, DEFAULT_API_BASE_URL);
    assert.equal(credentials.apiBaseUrl, 'https://api.getcount.com');
  });

  it('saves and reloads credentials with restricted file permissions', async () => {
    const temporaryHomeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'count-cli-home-'));
    const configFilePath = getConfigFilePath({ homeDirectory: temporaryHomeDirectory });
    const credentials = buildDefaultCredentials({
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });

    await saveCredentials({ credentials, configFilePath });
    const reloadedCredentials = await loadCredentials({ configFilePath });
    const fileStats = await fs.stat(configFilePath);

    assert.deepEqual(reloadedCredentials, credentials);
    assert.equal((fileStats.mode & 0o777).toString(8), '600');
  });

  it('deletes credentials when logging out', async () => {
    const temporaryHomeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'count-cli-home-'));
    const configFilePath = getConfigFilePath({ homeDirectory: temporaryHomeDirectory });
    const credentials = buildDefaultCredentials({
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });

    await saveCredentials({ credentials, configFilePath });
    await deleteCredentials({ configFilePath });

    const reloadedCredentials = await loadCredentials({ configFilePath });
    assert.equal(reloadedCredentials, null);
  });
});
