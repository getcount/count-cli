export interface McpKnowledgeTopic {
  id: string;
  title: string;
  summary: string;
  content: string;
  relatedTopicIds: string[];
  keywords: string[];
}

export const MCP_KNOWLEDGE_TOPICS: McpKnowledgeTopic[] = [
  {
    id: 'authorize_additional_workspaces',
    title: 'Can I authorize additional workspaces?',
    summary:
      'Authorized workspaces are fixed at connect time. Disconnect the COUNT connector and reconnect to pick a wider workspace set on the consent screen.',
    relatedTopicIds: ['reconnect_count_connector', 'multiple_workspaces', 'auth_status_vs_count_app'],
    keywords: [
      'workspace',
      'authorize',
      'additional',
      'reconnect',
      'consent',
      'scope',
      'client',
      'firm',
      'access',
    ],
    content: [
      'Yes — but only by reconnecting the COUNT MCP connector and completing the consent flow again.',
      '',
      'How it works:',
      '- The workspaces this connection can use are captured when you first connect (OAuth consent).',
      '- They do NOT update automatically when you later gain access to more client workspaces in the COUNT web app.',
      '- Refreshing tokens does NOT add workspaces. Call COUNT_auth_status or COUNT_list_workspaces to see the current authorized set for this connection only.',
      '',
      'To authorize more workspaces:',
      '1. Disconnect the COUNT connector in your AI client (see topic reconnect_count_connector).',
      '2. Connect COUNT again and sign in with your COUNT account.',
      '3. On the workspace selection step, choose every client workspace you want this connection to access (multiple selections or “all accessible workspaces” when offered).',
      '4. Finish consent, then call COUNT_list_workspaces to confirm the new authorized list.',
      '',
      'Firm staff: you can only authorize workspaces you already have access to in COUNT at reconnect time — the consent screen never grants access beyond your firm membership.',
    ].join('\n'),
  },
  {
    id: 'reconnect_count_connector',
    title: 'How do I disconnect and reconnect the COUNT MCP connector?',
    summary:
      'Remove the COUNT connector in your AI app settings, then add it again to run through sign-in and workspace selection.',
    relatedTopicIds: ['authorize_additional_workspaces', 'multiple_workspaces'],
    keywords: ['disconnect', 'reconnect', 'connector', 'claude', 'chatgpt', 'oauth', 'integration'],
    content: [
      'Claude (claude.ai or Claude Desktop):',
      '1. Open Settings → Connectors (wording may be “Integrations”).',
      '2. Find COUNT in the list and disconnect or remove it.',
      '3. Add / connect COUNT again and complete sign-in when redirected to COUNT.',
      '4. Select the workspace(s) to authorize, then approve access.',
      '',
      'ChatGPT:',
      '1. Open Settings → Connectors / Apps.',
      '2. Remove the COUNT connector.',
      '3. Re-add COUNT and complete the OAuth sign-in and workspace selection flow.',
      '',
      'After reconnecting, call COUNT_auth_status and COUNT_list_workspaces before other tools so you know which workspace UUIDs are in scope.',
      '',
      'Standalone COUNT CLI MCP (developer token): workspace scope is configured in your environment — reconnecting the hosted connector does not apply.',
    ].join('\n'),
  },
  {
    id: 'multiple_workspaces',
    title: 'How do I work with multiple authorized workspaces?',
    summary:
      'Call COUNT_list_workspaces, pass workspace_id on every read/write tool when more than one workspace is authorized, and optionally COUNT_set_active_workspace for session context.',
    relatedTopicIds: ['authorize_additional_workspaces', 'external_uuids'],
    keywords: ['workspace_id', 'list_workspaces', 'set_active_workspace', 'multi', 'switch'],
    content: [
      'When this connection has more than one authorized workspace:',
      '- COUNT_list_workspaces — lists every workspace UUID, name, currency, and (for firm connections) whether it is a firm client workspace.',
      '- COUNT_auth_status — shows authorizedWorkspaces and which workspace is active for echo/context.',
      '- Pass workspace_id (external COUNT workspace UUID) on every partner read/write tool when multiple workspaces are authorized.',
      '- COUNT_set_active_workspace — updates the session default for auth_status and the “Workspace:” echo line only; it does NOT replace workspace_id on API calls.',
      '',
      'When only one workspace is authorized, workspace_id is optional on partner tools.',
    ].join('\n'),
  },
  {
    id: 'auth_status_vs_count_app',
    title: 'Why does auth_status show fewer workspaces than I see in COUNT?',
    summary:
      'auth_status lists workspaces authorized for this MCP connection at consent time, not every workspace visible in the COUNT web app.',
    relatedTopicIds: ['authorize_additional_workspaces', 'reconnect_count_connector'],
    keywords: ['auth_status', 'missing', 'workspace', 'token', 'scope'],
    content: [
      'COUNT_auth_status and COUNT_list_workspaces reflect this connector’s authorized workspace set, not your full COUNT account access.',
      '',
      'Common reasons for a mismatch:',
      '- You connected before gaining access to additional firm client workspaces → reconnect to expand the set.',
      '- You selected only a subset on the consent screen → reconnect and select the missing workspaces.',
      '- You are comparing to workspaces visible in the COUNT web app that were never included in this connection’s consent.',
      '',
      'The scope field on auth_status may be null; rely on authorizedWorkspaces / COUNT_list_workspaces as the source of truth for this connection.',
    ].join('\n'),
  },
  {
    id: 'create_chart_of_accounts_account',
    title: 'How do I create a new chart-of-accounts account (e.g. credit card)?',
    summary:
      'Call COUNT_list_account_sub_types first, pick the matching sub-type id, then COUNT_create_account or COUNT_bulk_create_accounts. Never guess subTypeId values. Complete the chart of accounts before importing bills or transactions.',
    relatedTopicIds: ['external_uuids', 'describe_endpoint'],
    keywords: [
      'create account',
      'chart of accounts',
      'subTypeId',
      'sub type',
      'credit card',
      'liability',
      'list_account_sub_types',
    ],
    content: [
      'To create a new account (bank, credit card, expense category, etc.):',
      '1. COUNT_list_account_sub_types — optional query.type filter (e.g. "Liabilities" for a credit card). Pick the row whose name matches what you need and copy its integer id.',
      '2. COUNT_create_account — body.name plus body.subTypeId set to that id. For migrations with many accounts, prefer COUNT_bulk_create_accounts (up to 100 rows per call, partial success).',
      '3. If a similar account already exists, you may instead COUNT_list_accounts with query.type and reuse subType.id from an existing row.',
      '',
      'Complete the full chart of accounts before importing bills or transactions. Partner-created accounts stay editable until used in postings. If delete fails with HAS_JOURNAL_ENTRIES, use COUNT_update_account with status inactive instead.',
      'Never guess or sequentially probe subTypeId numbers — they are sparse global ids, not a predictable sequence.',
      'If create_account fails, tell the user COUNT could not create the account and share requestId when present. Do not quote stack traces, file paths, or internal database fields.',
    ].join('\n'),
  },
  {
    id: 'partner_error_hygiene',
    title: 'What should I tell the user when a COUNT tool fails?',
    summary:
      'Use plain business language plus requestId when available. Never expose stack traces, source files, or internal implementation details.',
    relatedTopicIds: ['describe_endpoint'],
    keywords: ['error', '500', 'stack', 'internal', 'requestId', 'failure'],
    content: [
      'When a COUNT partner or MCP tool returns an error:',
      '- Tell the user what you were trying to do and that COUNT could not complete it.',
      '- Include requestId from the error payload when present so support can trace the call.',
      '- Read _mcpRecoveryHint for suggested next tools (list_account_sub_types, validate_payload, knowledge topics).',
      '',
      'Never include in user-visible text:',
      '- Stack traces or line numbers (e.g. accounts.service.js:141)',
      '- Source file paths, function names, or ORM/SQL internals',
      '- Internal database column names (accountTypeId, subTypeId probing commentary, etc.)',
      '- Narration of your debugging process ("let me probe subtype 14")',
    ].join('\n'),
  },
  {
    id: 'external_uuids',
    title: 'Which IDs should I pass to COUNT tools?',
    summary:
      'Always use external COUNT UUIDs from list/get tool results. Never pass internal numeric database ids.',
    relatedTopicIds: ['report_category_filters', 'describe_endpoint'],
    keywords: ['uuid', 'id', 'numeric', 'list_accounts', 'partner'],
    content: [
      'Partner and MCP tools expose external UUIDs as id in responses.',
      '- Get UUIDs from the matching COUNT_list_* or COUNT_get_* tool (accounts, customers, vendors, bills, etc.).',
      '- Pass that UUID as id in path parameters and as vendorUuid, customerUuid, categoryAccountUuid, and similar UUID fields in bodies/queries.',
      '- Internal numeric ids are workspace-local and are rejected or silently ignored on many partner endpoints.',
      '',
      'Before an unfamiliar create/update call, use COUNT_describe_endpoint with the tool name for field-level guidance.',
    ].join('\n'),
  },
  {
    id: 'report_category_filters',
    title: 'How do I filter a P&L or report to one expense category?',
    summary:
      'Pass the account UUID from COUNT_list_accounts as categoryAccount or categoryAccountUuid in the report query.',
    relatedTopicIds: ['external_uuids'],
    keywords: ['pnl', 'profit', 'loss', 'category', 'shipping', 'freight', 'report', 'filter'],
    content: [
      'Use COUNT_generate_profit_and_loss with query filters, not a numeric account id.',
      '',
      'Example — spending on “Freight & Courier” for calendar 2025:',
      '1. COUNT_list_accounts — find the expense account (e.g. Freight & Courier) and copy its id UUID.',
      '2. COUNT_generate_profit_and_loss with query: { startDate: "2025-01-01", endDate: "2025-12-31", categoryAccount: "<account-uuid>" }.',
      '',
      'Aliases accepted: categoryAccount, categoryAccountUuid, categoryAccountUuids (comma-separated).',
      'Trial balance / balance sheet: use accounts or accountUuids the same way.',
      'Report filters belong under the top-level query key, not body.',
    ].join('\n'),
  },
  {
    id: 'bulk_operations',
    title: 'How should I run bulk imports (transactions, customers, etc.)?',
    summary:
      'Use bulk MCP tools with partial-success envelopes; recommended ~25 rows per call for large historical imports.',
    relatedTopicIds: ['external_uuids'],
    keywords: ['bulk', 'batch', 'import', 'migration', 'partial', 'success'],
    content: [
      'Bulk tools (COUNT_bulk_create_transactions, COUNT_bulk_create_customers, COUNT_bulk_update_customers, COUNT_bulk_update_budget_cells, etc.) return:',
      '{ successCount, errorCount, results: [{ index, success, ... | error }] } with HTTP 201 when the batch is accepted.',
      '',
      'Best practices:',
      '- Read errorCount first; retry only rows where success is false.',
      '- Hard cap: 100 rows per call.',
      '- Recommended batch size: ~25 rows for large backfills (billing-system migrations) to reduce timeout risk.',
      '- Each row is isolated — one failure does not roll back other rows in the same batch.',
      '- Call COUNT_validate_payload before each bulk batch and COUNT_playbooks (migration_import, budget_import, create_invoice_and_send, setup_accounts_and_import_transactions, or plan_budget_and_review_actuals) for the full workflow.',
      '',
      'Failure handling example:',
      '1. const failures = result.results.filter((row) => !row.success);',
      '2. Map each failure.index back to your input array.',
      '3. Retry only failed rows in a new bulk call after fixing the error string.',
      '',
      'HTTP 201 is returned when the batch envelope is accepted — even if every row failed. HTTP 400 only when the envelope itself is invalid (>100 rows, missing array).',
      'Row failures carry error as a plain string message (not a structured errors[] array).',
    ].join('\n'),
  },
  {
    id: 'budget_export_import',
    title: 'How do I export or import budgets for Excel editing?',
    summary:
      'Use get_budget_grid to export JSON, edit offline, then bulk_update_budget_cells in ~25-row batches on a draft version.',
    relatedTopicIds: ['bulk_operations', 'external_uuids'],
    keywords: ['budget', 'excel', 'export', 'import', 'grid', 'forecast'],
    content: [
      'Partner budget tools are JSON-only (no CSV upload). Typical Excel round-trip:',
      '1. COUNT_get_budget_grid with includeActuals=false for budget amounts only.',
      '2. Edit amounts in Excel externally — keep accountUuid + periodStart + amount columns aligned with the grid.',
      '3. COUNT_bulk_update_budget_cells on a draft versionNumber (~25 rows per call; hard cap 100).',
      '4. Optional COUNT_publish_budget when ready.',
      '',
      'Rows require accountUuid (from list_accounts / resolve_references) and periodStart (YYYY-MM-DD from grid columns).',
      'See COUNT_playbooks playbook budget_import for the ordered workflow.',
    ].join('\n'),
  },
  {
    id: 'legacy_numeric_fields_rejected',
    title: 'Why were numeric vendorId, tags, or vendors query params rejected?',
    summary:
      'Partner bill and list endpoints require UUID fields (vendorUuid, tagUuids, vendorUuids). Numeric legacy fields return 400, not silent ignore.',
    relatedTopicIds: ['external_uuids', 'describe_endpoint'],
    keywords: ['numeric', 'vendorId', 'tags', 'vendors', 'rejected', '400', 'legacy'],
    content: [
      'Partner MCP tools expose external UUIDs only. Numeric internal database ids are rejected on many endpoints.',
      '',
      'Common 400 cases:',
      '- Bill list: use query.vendorUuids (comma-separated), not query.vendors.',
      '- Bill create/update: use vendorUuid, tagUuids, projectUuid — not vendorId, tags, projectId.',
      '- Line items: use categoryAccountUuid — not categoryAccountId.',
      '',
      'Use COUNT_resolve_references to map names to UUIDs, or COUNT_list_* tools to copy id values from responses.',
      'Call COUNT_validate_payload before bulk imports to catch these issues early.',
    ].join('\n'),
  },
  {
    id: 'partner_warnings',
    title: 'What does _partnerWarnings mean on a successful response?',
    summary:
      'Some fields you sent were ignored. Read _partnerWarnings before assuming the update applied every field.',
    relatedTopicIds: ['describe_endpoint', 'external_uuids'],
    keywords: ['warnings', 'ignored', 'internal_only', 'unknown_field', 'partnerWarnings'],
    content: [
      'Create/update responses may include _partnerWarnings: [{ field, reason, message }].',
      '',
      'reason values:',
      '- internal_only — field is managed by COUNT internally (e.g. billId on transaction update). Use the dedicated tool instead.',
      '- unknown_field — typo or field not on the model. Call COUNT_describe_endpoint for the tool you used.',
      '',
      'HTTP 200 with warnings does NOT mean every field you sent was applied. Always read _partnerWarnings.',
    ].join('\n'),
  },
  {
    id: 'partner_error_handling',
    title: 'How do MCP tool errors look and what should I do?',
    summary:
      'MCP errors return { message, statusCode, responseBody, _mcpRecoveryHint }. There is no structured errors[] array — fix the message and use validate_payload before retrying writes.',
    relatedTopicIds: ['partner_error_hygiene', 'rate_limits_and_throttling', 'describe_endpoint'],
    keywords: ['400', '401', '404', '429', '500', 'error', 'retry', 'validation'],
    content: [
      'MCP tool failures set isError: true. The JSON is in content[0].text:',
      '{ "message": "...", "statusCode": 400, "responseBody": { ... }, "_mcpRecoveryHint": { ... } }',
      '',
      'Status guide:',
      '- 400 — validation or business rule failure. Read message (often a single joined string). Call COUNT_validate_payload before retrying. Do not retry unchanged payloads.',
      '- 401 — auth failure. MCP auto-refreshes once; if it still fails, reconnect or refresh tokens.',
      '- 403 — workspace not authorized for this credential. Check COUNT_list_workspaces / OAuth consent.',
      '- 404 — entity UUID not found in workspace. Re-resolve via COUNT_resolve_references or list_* tools.',
      '- 429 — rate limit (type RATE_LIMITED). Back off — see rate_limits_and_throttling topic.',
      '- 500 — server error. Share responseBody.requestId when present; do not retry blindly.',
      '',
      'Partner API HTTP responses use a similar message/statusCode shape. Field-level errors[] arrays are not emitted today.',
    ].join('\n'),
  },
  {
    id: 'field_naming_reference',
    title: 'Canonical partner API field names for references',
    summary:
      'Use accUuid for bank accounts, categoryAccountUuid for expense/income categories, vendorUuid/customerUuid/projectUuid for entities, tagUuids (array in body, comma-separated in query).',
    relatedTopicIds: ['external_uuids', 'legacy_numeric_fields_rejected'],
    keywords: ['accUuid', 'categoryAccountUuid', 'vendorUuid', 'customerUuid', 'tagUuids', 'naming'],
    content: [
      'Request field naming (canonical):',
      '- Bank/cash account: accUuid (create/update transaction). Response may show accountId.',
      '- Expense/income category: categoryAccountUuid (transactions, bill line items, change category).',
      '- Vendor: vendorUuid (bills, expense transactions).',
      '- Customer: customerUuid (invoices, income transactions).',
      '- Project: projectUuid.',
      '- Tags: tagUuids as string[] in bodies; comma-separated string or array in list query filters.',
      '',
      'List query aliases (accepted but prefer canonical names): accountUuid for accUuid; type for transactionTypes.',
      '',
      'Do not use: vendorId, customerId, tags (numeric), accountId in request bodies where a *Uuid field exists.',
      'Call COUNT_validate_payload to catch swapped accUuid vs categoryAccountUuid before the HTTP call.',
    ].join('\n'),
  },
  {
    id: 'rate_limits_and_throttling',
    title: 'What rate limits apply to COUNT MCP and partner API calls?',
    summary:
      'Standalone MCP/CLI: 100 req/min per client id. Hosted /mcp sessions: 120 req/min with Retry-After. Bulk: ~25 rows/batch, ~2s between batches recommended.',
    relatedTopicIds: ['bulk_operations', 'partner_error_handling'],
    keywords: ['429', 'rate limit', 'throttle', 'bulk', 'retry', 'backoff'],
    content: [
      'Limits:',
      '- Global partner API gate: 100 requests/minute per x-client-id (standalone MCP and CLI hit this).',
      '- Hosted MCP session (/mcp): 120 requests/minute per session (Retry-After header when limited).',
      '- Bulk operations: hard cap 100 rows/call; recommended ~25 rows/batch with ~2 second delay between batches for backfills.',
      '- Reports: no separate cap — shares the global limit; avoid >5 parallel report calls.',
      '',
      'On 429: read message and responseBody.type RATE_LIMITED; exponential backoff (1s, 2s, 4s); never burst >20 req/sec.',
      'Include responseBody.requestId in support requests when rate limits persist.',
    ].join('\n'),
  },
  {
    id: 'invoice_lifecycle',
    title: 'Invoice lifecycle — which tools work in each state?',
    summary:
      'draft → approve_invoice → send_invoice → assign_transaction (payment). No revert_to_draft API. Approved invoices need credit memo flow to correct mistakes.',
    relatedTopicIds: ['field_naming_reference', 'partner_error_handling'],
    keywords: ['invoice', 'draft', 'approved', 'sent', 'paid', 'lifecycle', 'state'],
    content: [
      'Typical flow: create_invoice (draft) → approve_invoice → send_invoice (sent/unpaid) → assign_transaction_to_bills_invoices (partial or full payment → paid/partial).',
      '',
      'Operation matrix:',
      '- update_invoice / delete_invoice: draft only (400 after approval).',
      '- approve_invoice: draft only (no-op if already approved).',
      '- send_invoice: requires approved (400 on draft).',
      '- assign_transaction_to_bills_invoices: approved/sent/unpaid/partial — not draft.',
      '- remove_invoice_transaction: paid/partial to unwind a payment.',
      '',
      'There is no revert_to_draft partner endpoint. To fix an approved invoice structurally, use credit memos or recreate at draft stage before approval.',
      'See playbook create_invoice_and_send for the ordered tool sequence.',
    ].join('\n'),
  },
  {
    id: 'bill_lifecycle',
    title: 'Bill lifecycle — which tools work in each state?',
    summary:
      'draft → approve_bill → assign_transaction (Expense payment). Paid bills cannot be deleted until payments are removed.',
    relatedTopicIds: ['external_uuids', 'partner_error_handling'],
    keywords: ['bill', 'draft', 'approved', 'paid', 'vendor', 'lifecycle'],
    content: [
      'Typical flow: create_bill (draft) → approve_bill → assign_transaction_to_bills_invoices with matchingType bill and Expense transaction.',
      '',
      'Operation matrix:',
      '- update_bill / delete_bill: draft preferred; restricted after approval/payment.',
      '- approve_bill: draft with line items.',
      '- assign_transaction_to_bills_invoices: approved bill + Expense transaction.',
      '- unassign_bill_transaction: remove an applied payment.',
      '- apply_vendor_memos_to_bill: approved bill + vendor memo UUIDs.',
      '',
      'delete_bill returns 400 when paidAmount > 0 — unassign payments first.',
      'See playbook pay_vendor_bill for payment workflow.',
    ].join('\n'),
  },
  {
    id: 'describe_endpoint',
    title: 'How do I learn the request shape for a COUNT tool?',
    summary: 'Call COUNT_describe_endpoint with the exact tool name before unfamiliar create/update operations.',
    relatedTopicIds: ['external_uuids'],
    keywords: ['describe', 'documentation', 'schema', 'fields', 'body', 'query'],
    content: [
      'COUNT_describe_endpoint returns:',
      '- Partner API path the tool calls',
      '- Tool description and readOnly/destructive flags',
      '- inputSchemaSummary — typed top-level input fields',
      '- commonErrors and responseShape when documented',
      '- Tips for body vs query placement',
      '- Link to https://developers.getcount.com/ for canonical field names',
      '',
      'COUNT_knowledge (this tool) answers connector and workflow FAQs; COUNT_describe_endpoint answers per-tool API shape questions.',
      'COUNT_playbooks provides ordered multi-step workflows (bill pay, migration import, budget import, month-end review, COA setup with import, budget planning with actuals review).',
    ].join('\n'),
  },
];

interface LookupMcpKnowledgeParams {
  topic?: string;
  search?: string;
}

interface LookupMcpKnowledgeResult {
  topics: McpKnowledgeTopic[];
  availableTopicIds: string[];
}

export function lookupMcpKnowledge(params: LookupMcpKnowledgeParams): LookupMcpKnowledgeResult {
  const { topic, search } = params;
  const availableTopicIds = MCP_KNOWLEDGE_TOPICS.map((_entry) => _entry.id);

  if (topic && topic.trim() !== '') {
    const normalizedTopic = topic.trim().toLowerCase();
    const matchedTopic = MCP_KNOWLEDGE_TOPICS.find(
      (_entry) => _entry.id.toLowerCase() === normalizedTopic || _entry.id.toLowerCase().replace(/_/g, ' ') === normalizedTopic
    );
    return {
      topics: matchedTopic ? [matchedTopic] : [],
      availableTopicIds,
    };
  }

  if (search && search.trim() !== '') {
    const normalizedSearch = search.trim().toLowerCase();
    const matchedTopics = MCP_KNOWLEDGE_TOPICS.filter((_entry) => {
      const haystack = [
        _entry.id,
        _entry.title,
        _entry.summary,
        _entry.content,
        ..._entry.keywords,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
    return { topics: matchedTopics, availableTopicIds };
  }

  return {
    topics: MCP_KNOWLEDGE_TOPICS.map((_entry) => ({
      id: _entry.id,
      title: _entry.title,
      summary: _entry.summary,
      content: _entry.content,
      relatedTopicIds: _entry.relatedTopicIds,
      keywords: _entry.keywords,
    })),
    availableTopicIds,
  };
}
