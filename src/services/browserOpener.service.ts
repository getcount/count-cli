import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

interface OpenBrowserParams {
  url: string;
}

export async function openBrowser(params: OpenBrowserParams): Promise<void> {
  const { url } = params;

  if (process.platform === 'darwin') {
    await execFileAsync('open', [url]);
    return;
  }

  if (process.platform === 'win32') {
    await execFileAsync('cmd', ['/c', 'start', '', url], { windowsHide: true });
    return;
  }

  await execFileAsync('xdg-open', [url]);
}
