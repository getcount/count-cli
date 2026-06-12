import crypto from 'node:crypto';
import type { HttpMethod, JsonObject } from './types.js';

const METHODS_WITH_BODY_HASH = new Set<HttpMethod>(['POST', 'PUT', 'PATCH']);

interface ComputeBodyHashParams {
  method: HttpMethod;
  body?: JsonObject;
}

interface ComputeSignatureParams {
  method: HttpMethod;
  path: string;
  timestamp: string;
  body?: JsonObject;
  clientSecret: string;
}

interface BuildSignatureBaseStringParams {
  method: HttpMethod;
  path: string;
  timestamp: string;
  bodyHash?: string;
}

export function computeBodyHash(params: ComputeBodyHashParams): string {
  const { method, body } = params;

  if (!METHODS_WITH_BODY_HASH.has(method)) {
    return '';
  }

  return crypto.createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
}

export function buildSignatureBaseString(params: BuildSignatureBaseStringParams): string {
  const { method, path, timestamp, bodyHash = '' } = params;
  return `${method}:${path}:${timestamp}:${bodyHash}`;
}

export function computePartnerSignature(params: ComputeSignatureParams): string {
  const { method, path, timestamp, body, clientSecret } = params;
  const bodyHash = computeBodyHash({ method, body });
  const baseString = buildSignatureBaseString({ method, path, timestamp, bodyHash });

  return crypto.createHmac('sha256', clientSecret).update(baseString).digest('hex');
}

