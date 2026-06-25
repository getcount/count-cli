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

const GENERIC_PARTNER_FAILURE_MESSAGE = 'could not process your request';

interface ResolveDocumentLifecycleContextParams {
  toolName: string;
  message?: string;
}

function resolveDocumentLifecycleContext(params: ResolveDocumentLifecycleContextParams): 'invoice' | 'bill' | null {
  const { toolName, message } = params;

  if (toolName === 'COUNT_assign_transaction_to_bills_invoices') {
    if (typeof message === 'string') {
      const normalizedMessage = message.toLowerCase();
      if (normalizedMessage.includes('bill')) {
        return 'bill';
      }
      if (normalizedMessage.includes('invoice')) {
        return 'invoice';
      }
    }
    return null;
  }

  if (toolName.includes('invoice')) {
    return 'invoice';
  }

  if (toolName.includes('_bills') || toolName.includes('_bill')) {
    return 'bill';
  }

  return null;
}

const RECOVERY_HINT_RULES: RecoveryHintRule[] = [
  {
    matches: (params) =>
      params.toolName === 'COUNT_create_account' &&
      params.statusCode === 500 &&
      typeof params.message === 'string' &&
      (params.message.includes(GENERIC_PARTNER_FAILURE_MESSAGE) ||
        params.message.includes('WHERE parameter') ||
        params.message.includes('accountTypeId')),
    build: () => ({
      summary:
        'Account creation failed server-side. Do not expose stack traces or file paths to the user — share requestId and suggest creating the account in the COUNT UI or retrying after support checks the error.',
      knowledgeTopic: 'partner_error_hygiene',
      describeTool: 'COUNT_create_account',
      suggestedNextTools: ['COUNT_knowledge', 'COUNT_list_account_sub_types', 'COUNT_describe_endpoint'],
    }),
  },
  {
    matches: (params) =>
      params.statusCode === 500 &&
      typeof params.message === 'string' &&
      params.message.includes(GENERIC_PARTNER_FAILURE_MESSAGE),
    build: (params) => ({
      summary:
        'COUNT returned a server error for this tool. Tell the user the action could not be completed, share requestId when present, and do not expose stack traces or file paths.',
      knowledgeTopic: 'partner_error_hygiene',
      describeTool: params.toolName,
      suggestedNextTools: ['COUNT_knowledge', 'COUNT_describe_endpoint'],
    }),
  },
  {
    matches: (params) =>
      typeof params.message === 'string' && params.message.includes('Invalid query parameter `type`'),
    build: () => ({
      summary:
        'COUNT_list_account_sub_types rejected query.type — use one of Assets, Liabilities, Equity, Income, Expenses (plural, case-sensitive). Omit query.type to list all sub-types.',
      knowledgeTopic: 'create_chart_of_accounts_account',
      describeTool: 'COUNT_list_account_sub_types',
      suggestedNextTools: ['COUNT_describe_endpoint', 'COUNT_knowledge'],
    }),
  },
  {
    matches: (params) =>
      typeof params.message === 'string' && params.message.includes('Account sub type not found'),
    build: () => ({
      summary:
        'Resolve subTypeId from COUNT_list_account_sub_types (preferred) or an existing list_accounts row — never guess ids.',
      knowledgeTopic: 'create_chart_of_accounts_account',
      describeTool: 'COUNT_create_account',
      suggestedNextTools: ['COUNT_list_account_sub_types', 'COUNT_knowledge', 'COUNT_describe_endpoint'],
    }),
  },
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
    matches: (params) =>
      params.statusCode === 429 ||
      params.errorCode === 'RATE_LIMITED' ||
      (typeof params.message === 'string' && params.message.toLowerCase().includes('too many requests')),
    build: () => ({
      summary: 'Rate limit exceeded — back off and retry. See rate_limits_and_throttling topic.',
      knowledgeTopic: 'rate_limits_and_throttling',
      suggestedNextTools: ['COUNT_knowledge'],
    }),
  },
  {
    matches: (params) => {
      const toolName = params.toolName ?? '';
      const lifecycleContext = resolveDocumentLifecycleContext({
        toolName,
        message: params.message,
      });
      if (!lifecycleContext) {
        return false;
      }
      return (
        typeof params.message === 'string' &&
        (params.message.includes('draft') ||
          params.message.includes('already approved') ||
          params.message.includes('cannot update') ||
          params.message.includes('must be approved'))
      );
    },
    build: (params) => {
      const lifecycleContext = resolveDocumentLifecycleContext({
        toolName: params.toolName ?? '',
        message: params.message,
      });
      const isInvoiceContext = lifecycleContext === 'invoice';
      return {
        summary: 'Invoice or bill state transition rejected — check invoice_lifecycle or bill_lifecycle topic.',
        knowledgeTopic: isInvoiceContext ? 'invoice_lifecycle' : 'bill_lifecycle',
        playbook: isInvoiceContext ? 'create_invoice_and_send' : 'pay_vendor_bill',
        describeTool: params.toolName,
        suggestedNextTools: ['COUNT_knowledge', 'COUNT_playbooks', 'COUNT_describe_endpoint'],
      };
    },
  },
  {
    matches: (params) =>
      params.statusCode === 400 &&
      typeof params.message === 'string' &&
      (params.message.includes('invalid') ||
        params.message.includes('required') ||
        params.message.includes('must be')),
    build: (params) => ({
      summary: 'Validation failed — call COUNT_validate_payload with the same toolName, body, and query before retrying.',
      knowledgeTopic: 'field_naming_reference',
      describeTool: params.toolName,
      suggestedNextTools: ['COUNT_validate_payload', 'COUNT_describe_endpoint', 'COUNT_knowledge'],
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

interface ExtractMachineErrorCodeParams {
  errorPayload: Record<string, unknown>;
}

/** Read machine error codes from top-level fields or nested COUNT API responseBody. */
function extractMachineErrorCode(params: ExtractMachineErrorCodeParams): string | undefined {
  const { errorPayload } = params;

  if (typeof errorPayload.error === 'string' && errorPayload.error.trim() !== '') {
    return errorPayload.error.trim();
  }
  if (typeof errorPayload.errorCode === 'string' && errorPayload.errorCode.trim() !== '') {
    return errorPayload.errorCode.trim();
  }

  const responseBody = errorPayload.responseBody;
  if (!responseBody || typeof responseBody !== 'object') {
    return undefined;
  }

  const responseBodyRecord = responseBody as Record<string, unknown>;
  if (typeof responseBodyRecord.error === 'string' && responseBodyRecord.error.trim() !== '') {
    return responseBodyRecord.error.trim();
  }
  if (typeof responseBodyRecord.errorCode === 'string' && responseBodyRecord.errorCode.trim() !== '') {
    return responseBodyRecord.errorCode.trim();
  }

  const nestedData = responseBodyRecord.data;
  if (nestedData && typeof nestedData === 'object') {
    const nestedDataRecord = nestedData as Record<string, unknown>;
    if (typeof nestedDataRecord.error === 'string' && nestedDataRecord.error.trim() !== '') {
      return nestedDataRecord.error.trim();
    }
    if (typeof nestedDataRecord.errorCode === 'string' && nestedDataRecord.errorCode.trim() !== '') {
      return nestedDataRecord.errorCode.trim();
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
  const errorCode = extractMachineErrorCode({ errorPayload });
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
