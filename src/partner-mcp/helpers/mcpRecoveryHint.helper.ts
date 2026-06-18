export interface McpRecoveryHint {
  summary: string;
  knowledgeTopic?: string;
  playbook?: string;
  describeTool?: string;
  suggestedNextTools: string[];
}

interface BuildMcpRecoveryHintParams {
  statusCode?: number;
  message?: string;
  errorCode?: string;
  toolName?: string;
  responseBody?: unknown;
}

interface RecoveryHintRule {
  matches: (params: BuildMcpRecoveryHintParams) => boolean;
  build: (params: BuildMcpRecoveryHintParams) => McpRecoveryHint;
}

const RECOVERY_HINT_RULES: RecoveryHintRule[] = [
  {
    matches: (params) =>
      typeof params.message === 'string' && params.message.includes('numeric `vendors` is not accepted'),
    build: () => ({
      summary: 'Bill list filters must use vendorUuids from list_vendors, not numeric vendors.',
      knowledgeTopic: 'external_uuids',
      describeTool: 'COUNT_list_bills',
      suggestedNextTools: ['COUNT_knowledge', 'COUNT_describe_endpoint'],
    }),
  },
  {
    matches: (params) =>
      typeof params.message === 'string' && params.message.includes('numeric `projects` is not accepted'),
    build: () => ({
      summary: 'Bill list filters must use projectUuids from list_projects, not numeric projects.',
      knowledgeTopic: 'external_uuids',
      describeTool: 'COUNT_list_bills',
      suggestedNextTools: ['COUNT_knowledge', 'COUNT_describe_endpoint'],
    }),
  },
  {
    matches: (params) =>
      typeof params.message === 'string' &&
      (params.message.includes('numeric `tags` is not accepted') ||
        params.message.includes('Use `tagUuids`')),
    build: () => ({
      summary: 'Bill and transaction tag fields must use tagUuids from list_tags, not numeric tags.',
      knowledgeTopic: 'external_uuids',
      describeTool: 'COUNT_create_bill',
      suggestedNextTools: ['COUNT_knowledge', 'COUNT_describe_endpoint'],
    }),
  },
  {
    matches: (params) =>
      typeof params.message === 'string' &&
      (params.message.includes('Use `vendorUuid`') || params.message.includes('numeric `vendorId` is not accepted')),
    build: () => ({
      summary: 'Use vendorUuid from list_vendors instead of numeric vendorId on bill requests.',
      knowledgeTopic: 'external_uuids',
      describeTool: 'COUNT_create_bill',
      suggestedNextTools: ['COUNT_knowledge', 'COUNT_resolve_references'],
    }),
  },
  {
    matches: (params) => params.statusCode === 403 && params.errorCode === 'workspace_not_authorized',
    build: () => ({
      summary:
        'The requested workspace is not authorized for this MCP connection. Reconnect to add workspaces or pick from list_workspaces.',
      knowledgeTopic: 'authorize_additional_workspaces',
      suggestedNextTools: ['COUNT_knowledge', 'COUNT_list_workspaces'],
    }),
  },
  {
    matches: (params) => params.statusCode === 403 && params.errorCode === 'firm_scope_required',
    build: () => ({
      summary:
        'Firm consolidated report tools require an accounting firm staff connection. Connect with firm scope or use per-workspace report tools.',
      knowledgeTopic: 'multiple_workspaces',
      suggestedNextTools: ['COUNT_auth_status', 'COUNT_knowledge'],
    }),
  },
  {
    matches: (params) =>
      params.statusCode === 400 &&
      (params.errorCode === 'workspace_required' ||
        params.errorCode === 'workspace_required_for_write' ||
        (typeof params.message === 'string' &&
          params.message.includes('Pass workspace_id when the connection has access to multiple workspaces'))),
    build: () => ({
      summary: 'Multiple workspaces are authorized — pass workspace_id on every read/write partner tool.',
      knowledgeTopic: 'multiple_workspaces',
      suggestedNextTools: ['COUNT_list_workspaces', 'COUNT_knowledge'],
    }),
  },
  {
    matches: (params) =>
      typeof params.message === 'string' && params.message.includes('Bulk requests are capped at 100'),
    build: () => ({
      summary: 'Split the import into multiple bulk calls (~25 rows recommended). See migration_import playbook.',
      knowledgeTopic: 'bulk_operations',
      playbook: 'migration_import',
      describeTool: 'COUNT_bulk_create_transactions',
      suggestedNextTools: ['COUNT_playbooks', 'COUNT_validate_payload'],
    }),
  },
  {
    matches: (params) => {
      if (!params.responseBody || typeof params.responseBody !== 'object') return false;
      const bodyRecord = params.responseBody as Record<string, unknown>;
      const nestedData =
        bodyRecord.data && typeof bodyRecord.data === 'object'
          ? (bodyRecord.data as Record<string, unknown>)
          : bodyRecord;
      return Array.isArray(nestedData._partnerWarnings) && nestedData._partnerWarnings.length > 0;
    },
    build: (params) => ({
      summary:
        'Some fields in your payload were ignored. Read _partnerWarnings in the response — use describe_endpoint for the correct field names.',
      knowledgeTopic: 'partner_warnings',
      describeTool: params.toolName,
      suggestedNextTools: ['COUNT_describe_endpoint', 'COUNT_knowledge'],
    }),
  },
];

export function buildMcpRecoveryHint(params: BuildMcpRecoveryHintParams): McpRecoveryHint | undefined {
  for (const rule of RECOVERY_HINT_RULES) {
    if (rule.matches(params)) {
      return rule.build(params);
    }
  }
  return undefined;
}

interface AttachMcpRecoveryHintParams {
  errorPayload: Record<string, unknown>;
  toolName?: string;
}

/** Merge _mcpRecoveryHint onto an error JSON payload when a rule matches. */
export function attachMcpRecoveryHint(params: AttachMcpRecoveryHintParams): Record<string, unknown> {
  const { errorPayload, toolName } = params;
  const message = typeof errorPayload.message === 'string' ? errorPayload.message : undefined;
  const statusCode = typeof errorPayload.statusCode === 'number' ? errorPayload.statusCode : undefined;
  const errorCode =
    typeof errorPayload.error === 'string'
      ? errorPayload.error
      : typeof errorPayload.errorCode === 'string'
        ? errorPayload.errorCode
        : undefined;
  const responseBody = errorPayload.responseBody;

  const recoveryHint = buildMcpRecoveryHint({
    statusCode,
    message,
    errorCode,
    toolName,
    responseBody,
  });

  if (!recoveryHint) {
    return errorPayload;
  }

  return {
    ...errorPayload,
    _mcpRecoveryHint: recoveryHint,
  };
}
