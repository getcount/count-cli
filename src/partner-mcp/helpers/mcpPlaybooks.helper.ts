export interface McpPlaybookStep {
  stepNumber: number;
  instruction: string;
  toolName: string;
  inputGuidance?: string;
}

export interface McpPlaybook {
  id: string;
  title: string;
  summary: string;
  steps: McpPlaybookStep[];
  relatedPlaybookIds: string[];
  relatedKnowledgeTopicIds: string[];
  keywords: string[];
}

export const MCP_PLAYBOOKS: McpPlaybook[] = [
  {
    id: 'pay_vendor_bill',
    title: 'Pay a vendor bill with a bank transaction',
    summary:
      'Find an approved bill, locate or create an Expense transaction, and apply the payment via assign_transaction_to_bills_invoices.',
    relatedPlaybookIds: [],
    relatedKnowledgeTopicIds: ['external_uuids', 'describe_endpoint'],
    keywords: ['bill', 'pay', 'vendor', 'ap', 'accounts payable', 'payment', 'expense'],
    steps: [
      {
        stepNumber: 1,
        instruction: 'List approved bills for the vendor or period you want to pay.',
        toolName: 'COUNT_list_bills',
        inputGuidance:
          'query: { approvalStatus: "approved", vendorUuids: "<vendor-uuid>", page: 1, limit: 50 }. Use vendorUuids from list_vendors — never numeric vendors.',
      },
      {
        stepNumber: 2,
        instruction: 'Load bill detail and confirm amountDue, currency, and billType.',
        toolName: 'COUNT_get_bill',
        inputGuidance: 'id: bill UUID from list_bills row id field.',
      },
      {
        stepNumber: 3,
        instruction:
          'Find an existing Expense bank transaction to apply, or create one if the payment is new.',
        toolName: 'COUNT_list_transactions',
        inputGuidance:
          'query filters for unreconciled Expense rows matching amount/date. Alternatively use COUNT_create_transaction with type Expense, accUuid, categoryAccountUuid, amount, postedDate.',
      },
      {
        stepNumber: 4,
        instruction: 'Apply the transaction to the bill.',
        toolName: 'COUNT_assign_transaction_to_bills_invoices',
        inputGuidance:
          'id: transaction UUID. body: { matchingType: "bill", records: [{ id: "<bill-uuid>", paymentAmount: <amount> }] }. Bill must be approved; transaction must be Expense type for vendor bills.',
      },
      {
        stepNumber: 5,
        instruction: 'Optional — reload bill detail to confirm paidAmount and amountDue updated.',
        toolName: 'COUNT_get_bill',
        inputGuidance: 'Same bill UUID as step 2.',
      },
    ],
  },
  {
    id: 'migration_import',
    title: 'Bulk import customers or bank transactions from another system',
    summary:
      'Confirm workspace scope, map accounts, resolve name references, preflight each batch, import in ~25-row chunks, then sanity-check with a P&L report.',
    relatedPlaybookIds: ['month_end_review'],
    relatedKnowledgeTopicIds: ['bulk_operations', 'external_uuids', 'multiple_workspaces'],
    keywords: ['import', 'migration', 'bulk', 'csv', 'backfill', 'qbo', 'xero', 'historical'],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Confirm which workspace you are importing into.',
        toolName: 'COUNT_auth_status',
        inputGuidance:
          'When multiple workspaces are authorized, also call COUNT_list_workspaces and pass workspace_id on every subsequent tool.',
      },
      {
        stepNumber: 2,
        instruction: 'Map bank accounts and expense/income category accounts in the chart of accounts.',
        toolName: 'COUNT_list_accounts',
        inputGuidance:
          'query: { search: "<name fragment>", type: "Expenses" } for categories; query without type for bank/cash accounts. Copy id UUIDs for accUuid and categoryAccountUuid.',
      },
      {
        stepNumber: 3,
        instruction: 'Resolve vendor/customer/account names to UUIDs before building bulk rows.',
        toolName: 'COUNT_resolve_references',
        inputGuidance:
          'Pass vendorName, customerName, customerEmail, accountName, accountType as needed. Use returned UUIDs in bulk row bodies.',
      },
      {
        stepNumber: 4,
        instruction: 'Preflight each batch payload before calling a bulk create tool.',
        toolName: 'COUNT_validate_payload',
        inputGuidance:
          'toolName: COUNT_bulk_create_transactions (or COUNT_bulk_create_customers). body: { transactions: [...] }. Set verifyReferences: true to confirm UUIDs exist.',
      },
      {
        stepNumber: 5,
        instruction: 'Import in batches of ~25 rows (hard cap 100 per call). Retry only failed row indices.',
        toolName: 'COUNT_bulk_create_transactions',
        inputGuidance:
          'body: { transactions: [<same shape as create_transaction>] }. Read errorCount first; retry rows where success is false.',
      },
      {
        stepNumber: 6,
        instruction: 'Sanity-check totals with a profit and loss report for the imported period.',
        toolName: 'COUNT_generate_profit_and_loss',
        inputGuidance: 'query: { startDate, endDate, basis: "accrual" } under top-level query key.',
      },
    ],
  },
  {
    id: 'month_end_review',
    title: 'Month-end workspace health review',
    summary:
      'Pull workspace stats, review open AP/AR, scan for uncategorized transactions, and run a trial balance or P&L for the closing period.',
    relatedPlaybookIds: ['migration_import'],
    relatedKnowledgeTopicIds: ['report_category_filters', 'external_uuids'],
    keywords: ['month end', 'close', 'review', 'reconcile', 'trial balance', 'stats', 'health'],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Pull CFO-style workspace snapshot for cash, AR, AP, and profitability.',
        toolName: 'COUNT_get_workspace_stats',
        inputGuidance: 'query: { include: "cash,receivables,payables,profitability" }.',
      },
      {
        stepNumber: 2,
        instruction: 'Review draft or unpaid vendor bills.',
        toolName: 'COUNT_list_bills',
        inputGuidance: 'query: { approvalStatus: "draft" } or filter by status/approvalStatus as needed.',
      },
      {
        stepNumber: 3,
        instruction: 'Review overdue or open customer invoices.',
        toolName: 'COUNT_list_invoices',
        inputGuidance: 'query pagination and status filters from COUNT_describe_endpoint for list_invoices.',
      },
      {
        stepNumber: 4,
        instruction: 'Scan for uncategorized or unreconciled bank transactions.',
        toolName: 'COUNT_list_transactions',
        inputGuidance:
          'Use query filters from COUNT_describe_endpoint. Uncategorized rows may lack a category account — use change_transaction_category to fix after review.',
      },
      {
        stepNumber: 5,
        instruction: 'Run trial balance or P&L for the closing period.',
        toolName: 'COUNT_generate_trial_balance',
        inputGuidance:
          'query: { startDate, endDate }. Alternative: COUNT_generate_profit_and_loss for income statement review.',
      },
    ],
  },
];

interface LookupMcpPlaybooksParams {
  playbook?: string;
  search?: string;
}

interface LookupMcpPlaybooksResult {
  playbooks: McpPlaybook[];
  availablePlaybookIds: string[];
}

export function lookupMcpPlaybooks(params: LookupMcpPlaybooksParams): LookupMcpPlaybooksResult {
  const { playbook, search } = params;
  const availablePlaybookIds = MCP_PLAYBOOKS.map((_entry) => _entry.id);

  if (playbook && playbook.trim() !== '') {
    const normalizedPlaybook = playbook.trim().toLowerCase();
    const matchedPlaybook = MCP_PLAYBOOKS.find(
      (_entry) =>
        _entry.id.toLowerCase() === normalizedPlaybook ||
        _entry.id.toLowerCase().replace(/_/g, ' ') === normalizedPlaybook
    );
    return {
      playbooks: matchedPlaybook ? [matchedPlaybook] : [],
      availablePlaybookIds,
    };
  }

  if (search && search.trim() !== '') {
    const normalizedSearch = search.trim().toLowerCase();
    const matchedPlaybooks = MCP_PLAYBOOKS.filter((_entry) => {
      const haystack = [_entry.id, _entry.title, _entry.summary, ..._entry.keywords, ..._entry.steps.map((_step) => _step.instruction)]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
    return { playbooks: matchedPlaybooks, availablePlaybookIds };
  }

  return {
    playbooks: MCP_PLAYBOOKS.map((_entry) => ({
      id: _entry.id,
      title: _entry.title,
      summary: _entry.summary,
      steps: _entry.steps,
      relatedPlaybookIds: _entry.relatedPlaybookIds,
      relatedKnowledgeTopicIds: _entry.relatedKnowledgeTopicIds,
      keywords: _entry.keywords,
    })),
    availablePlaybookIds,
  };
}
