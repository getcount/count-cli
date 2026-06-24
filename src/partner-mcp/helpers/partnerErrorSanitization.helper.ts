/**
 * Strip implementation details from partner / MCP error payloads before they
 * reach external callers. Even on dev hosts, partner surfaces must not leak
 * stack traces, Sequelize internals, or source file references.
 */

const INTERNAL_ERROR_MESSAGE_PATTERN =
  /(\.js:\d+|\.ts:\d+|sequelize|node_modules|accountTypeId|WHERE parameter|at\s+\w+\s+\()/i;

const GENERIC_PARTNER_ERROR_MESSAGE = 'We could not process your request right now. Please try again in a moment.';

interface SanitizePartnerErrorMessageParams {
  message: string;
}

export function sanitizePartnerErrorMessage(params: SanitizePartnerErrorMessageParams): string {
  const { message } = params;
  if (!message || message.trim() === '') {
    return GENERIC_PARTNER_ERROR_MESSAGE;
  }
  if (INTERNAL_ERROR_MESSAGE_PATTERN.test(message)) {
    return GENERIC_PARTNER_ERROR_MESSAGE;
  }
  return message;
}

interface SanitizePartnerErrorBodyParams {
  errorBody: Record<string, unknown>;
}

export function sanitizePartnerErrorBody(params: SanitizePartnerErrorBodyParams): Record<string, unknown> {
  const { errorBody } = params;
  const sanitizedBody: Record<string, unknown> = {
    message: sanitizePartnerErrorMessage({
      message: typeof errorBody.message === 'string' ? errorBody.message : GENERIC_PARTNER_ERROR_MESSAGE,
    }),
    status: errorBody.status ?? 'Error',
    statusCode: typeof errorBody.statusCode === 'number' ? errorBody.statusCode : 500,
    isOperational: Boolean(errorBody.isOperational),
  };

  if (typeof errorBody.customMsg === 'string') {
    sanitizedBody.customMsg = sanitizePartnerErrorMessage({ message: errorBody.customMsg });
  } else if (typeof sanitizedBody.message === 'string') {
    sanitizedBody.customMsg = sanitizedBody.message;
  }

  if (typeof errorBody.requestId === 'string' && errorBody.requestId.trim() !== '') {
    sanitizedBody.requestId = errorBody.requestId;
  }

  if (typeof errorBody.type === 'string' && errorBody.type.trim() !== '') {
    sanitizedBody.type = errorBody.type;
  }

  if (typeof errorBody.error === 'string' && errorBody.error.trim() !== '') {
    sanitizedBody.error = errorBody.error;
  }

  if (typeof errorBody.error_description === 'string' && errorBody.error_description.trim() !== '') {
    sanitizedBody.error_description = sanitizePartnerErrorMessage({ message: errorBody.error_description });
  }

  return sanitizedBody;
}

interface SanitizeMcpToolErrorPayloadParams {
  errorPayload: Record<string, unknown>;
}

export function sanitizeMcpToolErrorPayload(params: SanitizeMcpToolErrorPayloadParams): Record<string, unknown> {
  const { errorPayload } = params;
  const sanitizedPayload: Record<string, unknown> = { ...errorPayload };

  delete sanitizedPayload.stack;

  if (typeof sanitizedPayload.message === 'string') {
    sanitizedPayload.message = sanitizePartnerErrorMessage({ message: sanitizedPayload.message });
  }

  const responseBody = sanitizedPayload.responseBody;
  if (responseBody && typeof responseBody === 'object') {
    sanitizedPayload.responseBody = sanitizePartnerErrorBody({
      errorBody: responseBody as Record<string, unknown>,
    });
  }

  return sanitizedPayload;
}
