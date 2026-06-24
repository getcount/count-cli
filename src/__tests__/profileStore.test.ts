import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  DEFAULT_PROFILE_NAME,
  getLegacyCredentialsFilePath,
  getProfileCredentialsFilePath,
  listProfileNames,
  migrateLegacyCredentialsToProfile,
  resolveCredentialsFilePath,
  setActiveProfileName,
} from '../services/profileStore.service.js';
import { buildDefaultCredentials, loadCredentials, saveCredentials } from '../services/credentialStore.service.js';

describe('profileStore', () => {
  it('uses legacy credentials path until profile mode is activated', async () => {
    const temporaryHomeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'count-cli-profile-home-'));
    const legacyCredentialsFilePath = getLegacyCredentialsFilePath({ homeDirectory: temporaryHomeDirectory });

    assert.equal(
      resolveCredentialsFilePath({ homeDirectory: temporaryHomeDirectory }),
      legacyCredentialsFilePath,
    );
  });

  it('switches to profile credentials after active profile is set', async () => {
    const temporaryHomeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'count-cli-profile-home-'));
    const profileName = 'acme-corp';
    const profileCredentialsFilePath = getProfileCredentialsFilePath({
      profileName,
      homeDirectory: temporaryHomeDirectory,
    });

    await setActiveProfileName({ profileName, homeDirectory: temporaryHomeDirectory });
    await saveCredentials({
      credentials: buildDefaultCredentials({
        clientId: 'client-id',
        clientSecret: 'client-secret',
      }),
      configFilePath: profileCredentialsFilePath,
    });

    assert.equal(
      resolveCredentialsFilePath({ homeDirectory: temporaryHomeDirectory }),
      profileCredentialsFilePath,
    );

    const profileNames = await listProfileNames({ homeDirectory: temporaryHomeDirectory });
    assert.deepEqual(profileNames, [profileName]);
  });

  it('migrates legacy credentials into a named profile', async () => {
    const temporaryHomeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'count-cli-profile-home-'));
    const legacyCredentialsFilePath = getLegacyCredentialsFilePath({ homeDirectory: temporaryHomeDirectory });
    const credentials = buildDefaultCredentials({
      clientId: 'legacy-client-id',
      clientSecret: 'legacy-client-secret',
    });

    await saveCredentials({ credentials, configFilePath: legacyCredentialsFilePath });
    const migrated = await migrateLegacyCredentialsToProfile({
      profileName: DEFAULT_PROFILE_NAME,
      homeDirectory: temporaryHomeDirectory,
    });

    assert.equal(migrated, true);
    const reloadedCredentials = await loadCredentials({
      profileName: DEFAULT_PROFILE_NAME,
      homeDirectory: temporaryHomeDirectory,
    });
    assert.equal(reloadedCredentials?.clientId, 'legacy-client-id');
  });
});
