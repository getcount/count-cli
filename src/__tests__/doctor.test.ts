import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDoctorReport, runDoctorChecks } from '../services/doctor.service.js';
import { buildDefaultCredentials, saveCredentials } from '../services/credentialStore.service.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getLegacyCredentialsFilePath } from '../services/profileStore.service.js';

describe('doctor', () => {
  it('reports missing login tokens when credentials are not authenticated', async () => {
    const temporaryHomeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'count-cli-doctor-home-'));
    const legacyCredentialsFilePath = getLegacyCredentialsFilePath({ homeDirectory: temporaryHomeDirectory });

    await saveCredentials({
      credentials: buildDefaultCredentials({
        clientId: 'client-id',
        clientSecret: 'client-secret',
      }),
      configFilePath: legacyCredentialsFilePath,
    });

    const doctorResult = await runDoctorChecks({
      homeDirectory: temporaryHomeDirectory,
      fetchImplementation: async () => new Response(null, { status: 200 }),
    });

    const loginCheck = doctorResult.checks.find((_check) => _check.checkId === 'login_tokens');
    assert.ok(loginCheck);
    assert.equal(loginCheck?.status, 'fail');
    assert.match(formatDoctorReport({ result: doctorResult }), /One or more checks failed/);
  });
});
