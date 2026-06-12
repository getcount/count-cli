import fs from 'node:fs/promises';

interface PersistRefreshedTokensParams {
  credentialsFilePath: string;
  accessToken: string;
  refreshToken: string;
}

export async function persistRefreshedTokens(params: PersistRefreshedTokensParams): Promise<void> {
  const { credentialsFilePath, accessToken, refreshToken } = params;

  let storedCredentials: Record<string, unknown>;
  try {
    const rawContents = await fs.readFile(credentialsFilePath, 'utf8');
    storedCredentials = JSON.parse(rawContents) as Record<string, unknown>;
  } catch {
    return;
  }

  storedCredentials.accessToken = accessToken;
  storedCredentials.refreshToken = refreshToken;

  await fs.writeFile(credentialsFilePath, `${JSON.stringify(storedCredentials, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}
