import { z } from 'zod';
import type { CountPartnerMcpConfig } from './types.js';

const optionalNonEmptyString = z.preprocess(
  (_value) => (_value === '' ? undefined : _value),
  z.string().trim().min(1).optional(),
);

const environmentSchema = z.object({
  COUNT_API_URL: z.string().trim().min(1).default('https://api.getcount.com'),
  COUNT_CLIENT_ID: z.string().trim().min(1),
  COUNT_CLIENT_SECRET: z.string().trim().min(1),
  COUNT_ACCESS_TOKEN: optionalNonEmptyString,
  COUNT_REFRESH_TOKEN: optionalNonEmptyString,
  COUNT_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  COUNT_CREDENTIALS_FILE: optionalNonEmptyString,
});

interface LoadConfigParams {
  environment?: NodeJS.ProcessEnv;
}

export function loadConfig(params: LoadConfigParams = {}): CountPartnerMcpConfig {
  const { environment = process.env } = params;
  const parsedEnvironment = environmentSchema.parse(environment);

  return {
    apiBaseUrl: parsedEnvironment.COUNT_API_URL.replace(/\/+$/, ''),
    clientId: parsedEnvironment.COUNT_CLIENT_ID,
    clientSecret: parsedEnvironment.COUNT_CLIENT_SECRET,
    accessToken: parsedEnvironment.COUNT_ACCESS_TOKEN,
    refreshToken: parsedEnvironment.COUNT_REFRESH_TOKEN,
    requestTimeoutMs: parsedEnvironment.COUNT_REQUEST_TIMEOUT_MS,
    credentialsFilePath: parsedEnvironment.COUNT_CREDENTIALS_FILE,
  };
}

