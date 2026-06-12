import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { startLocalCallbackServer } from '../services/localCallbackServer.service.js';

describe('localCallbackServer', () => {
  it('accepts a matching OAuth callback and returns code and state', async () => {
    const callbackServer = await startLocalCallbackServer({
      host: '127.0.0.1',
      port: 0,
      callbackPath: '/callback',
      expectedState: 'expected-state',
      timeoutMs: 5000,
    });

    try {
      const waitPromise = callbackServer.waitForCallback();
      const callbackUrl = new URL(callbackServer.redirectUri);
      callbackUrl.searchParams.set('code', 'auth-code');
      callbackUrl.searchParams.set('state', 'expected-state');

      const response = await fetch(callbackUrl.toString());
      assert.equal(response.status, 200);

      const callbackResult = await waitPromise;
      assert.deepEqual(callbackResult, {
        code: 'auth-code',
        state: 'expected-state',
      });
    } finally {
      await callbackServer.close();
    }
  });

  it('closes quickly after a successful callback even when close is called twice', async () => {
    const callbackServer = await startLocalCallbackServer({
      host: '127.0.0.1',
      port: 0,
      callbackPath: '/callback',
      expectedState: 'expected-state',
      timeoutMs: 5000,
    });

    const waitPromise = callbackServer.waitForCallback();
    const callbackUrl = new URL(callbackServer.redirectUri);
    callbackUrl.searchParams.set('code', 'auth-code');
    callbackUrl.searchParams.set('state', 'expected-state');

    await fetch(callbackUrl.toString());
    await waitPromise;

    const closeStartedAt = Date.now();
    await callbackServer.close();
    await callbackServer.close();
    const closeDurationMs = Date.now() - closeStartedAt;

    assert.ok(closeDurationMs < 1000, `expected close to finish quickly, took ${closeDurationMs}ms`);
  });

  it('ignores a malformed callback before accepting a valid redirect', async () => {
    const callbackServer = await startLocalCallbackServer({
      host: '127.0.0.1',
      port: 0,
      callbackPath: '/callback',
      expectedState: 'expected-state',
      timeoutMs: 5000,
    });

    try {
      const waitPromise = callbackServer.waitForCallback();
      const malformedCallbackUrl = new URL(callbackServer.redirectUri);
      malformedCallbackUrl.searchParams.set('state', 'wrong-state');

      const malformedResponse = await fetch(malformedCallbackUrl.toString());
      assert.equal(malformedResponse.status, 400);

      const validCallbackUrl = new URL(callbackServer.redirectUri);
      validCallbackUrl.searchParams.set('code', 'auth-code');
      validCallbackUrl.searchParams.set('state', 'expected-state');

      const validResponse = await fetch(validCallbackUrl.toString());
      assert.equal(validResponse.status, 200);

      const callbackResult = await waitPromise;
      assert.deepEqual(callbackResult, {
        code: 'auth-code',
        state: 'expected-state',
      });
    } finally {
      await callbackServer.close();
    }
  });
});
