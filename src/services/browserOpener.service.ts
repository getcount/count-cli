import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

interface OpenBrowserParams {
  url: string;
}

interface OpenBrowserOnWindowsParams {
  url: string;
}

async function openBrowserOnWindows(params: OpenBrowserOnWindowsParams): Promise<void> {
  const { url } = params;

  // Do not use `cmd /c start` — cmd.exe treats `&` in OAuth query strings as command separators,
  // so the browser only receives the first parameter (clientId) and login fails.
  try {
    await execFileAsync('rundll32', ['url.dll,FileProtocolHandler', url], { windowsHide: true });
    return;
  } catch {
    await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', `Start-Process ${JSON.stringify(url)}`],
      { windowsHide: true },
    );
  }
}

export async function openBrowser(params: OpenBrowserParams): Promise<void> {
  const { url } = params;

  if (process.platform === 'darwin') {
    await execFileAsync('open', [url]);
    return;
  }

  if (process.platform === 'win32') {
    await openBrowserOnWindows({ url });
    return;
  }

  await execFileAsync('xdg-open', [url]);
}
