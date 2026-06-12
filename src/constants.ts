import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageJsonPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };

export const CLI_VERSION = packageJson.version;
export const DEFAULT_API_BASE_URL = 'https://dev-api.getcount.com';
export const DEFAULT_CALLBACK_HOST = '127.0.0.1';
export const DEFAULT_CALLBACK_PORT = 17845;
export const DEFAULT_CALLBACK_PATH = '/callback';
export const DEFAULT_CONFIG_DIRECTORY_NAME = '.count';
export const DEFAULT_CONFIG_FILE_NAME = 'credentials.json';
export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
export const OAUTH_LOGIN_TIMEOUT_MS = 300000;
export const PARTNERS_PORTAL_URL = 'https://dev-app.getcount.com/count-partners';
export const DEVELOPER_DOCS_URL = 'https://developers.getcount.com';
