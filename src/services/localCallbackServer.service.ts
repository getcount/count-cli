import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { OAuthCallbackResult } from '../types.js';

interface StartLocalCallbackServerParams {
  host: string;
  port: number;
  callbackPath: string;
  expectedState: string;
  timeoutMs: number;
}

interface StartLocalCallbackServerResult {
  redirectUri: string;
  waitForCallback: () => Promise<OAuthCallbackResult>;
  close: () => Promise<void>;
}

interface ParseCallbackQueryParams {
  requestUrl: string;
  expectedState: string;
}

function parseCallbackQuery(params: ParseCallbackQueryParams): OAuthCallbackResult {
  const parsedUrl = new URL(params.requestUrl, 'http://localhost');
  const code = parsedUrl.searchParams.get('code');
  const state = parsedUrl.searchParams.get('state');
  const error = parsedUrl.searchParams.get('error');
  const errorDescription = parsedUrl.searchParams.get('error_description');

  if (error) {
    throw new Error(errorDescription ?? error);
  }

  if (!code || !state) {
    throw new Error('OAuth callback is missing code or state.');
  }

  if (state !== params.expectedState) {
    throw new Error('OAuth callback state does not match the value sent at login start.');
  }

  return { code, state };
}

function buildSuccessHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>COUNT login complete</title>
  </head>
  <body>
    <p>COUNT login complete. You can close this tab and return to your terminal.</p>
  </body>
</html>`;
}

function buildErrorHtml(params: { message: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>COUNT login failed</title>
  </head>
  <body>
    <p>COUNT login failed: ${params.message}</p>
  </body>
</html>`;
}

export async function startLocalCallbackServer(
  params: StartLocalCallbackServerParams,
): Promise<StartLocalCallbackServerResult> {
  let resolveCallback: ((value: OAuthCallbackResult) => void) | undefined;
  let rejectCallback: ((reason?: unknown) => void) | undefined;
  let timeoutHandle: NodeJS.Timeout | undefined;

  let callbackSettled = false;

  const callbackPromise = new Promise<OAuthCallbackResult>((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });

  const server = http.createServer((request, response) => {
    if (!request.url) {
      response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Bad request');
      return;
    }

    const requestPath = new URL(request.url, 'http://localhost').pathname;

    if (requestPath !== params.callbackPath) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    try {
      const callbackResult = parseCallbackQuery({
        requestUrl: request.url,
        expectedState: params.expectedState,
      });

      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(buildSuccessHtml());

      if (!callbackSettled) {
        callbackSettled = true;
        resolveCallback?.(callbackResult);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const parsedUrl = new URL(request.url, 'http://localhost');
      const oauthProviderError = parsedUrl.searchParams.get('error');

      response.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
      response.end(buildErrorHtml({ message }));

      // Ignore malformed probes (refresh, prefetch) so a later valid redirect can still succeed.
      if (oauthProviderError && !callbackSettled) {
        callbackSettled = true;
        rejectCallback?.(error);
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(params.port, params.host, () => resolve());
  });

  const address = server.address() as AddressInfo;
  const redirectUri = `http://${address.address}:${address.port}${params.callbackPath}`;

  timeoutHandle = setTimeout(() => {
    if (!callbackSettled) {
      callbackSettled = true;
      rejectCallback?.(new Error(`OAuth login timed out after ${params.timeoutMs}ms.`));
    }
  }, params.timeoutMs);

  const waitForCallback = async (): Promise<OAuthCallbackResult> => {
    try {
      return await callbackPromise;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  };

  const close = async (): Promise<void> => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  };

  return {
    redirectUri,
    waitForCallback,
    close,
  };
}
