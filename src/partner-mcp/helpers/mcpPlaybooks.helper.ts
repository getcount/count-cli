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
    id: 'create_invoice_and_send',
    title: 'Create, approve, send, and optionally collect payment on an invoice',
    summary:
      'Ordered invoice workflow: create (draft) → approve → send → optional payment via assign_transaction_to_bills_invoices.',
    relatedPlaybookIds: ['pay_vendor_bill'],
    relatedKnowledgeTopicIds: ['invoice_lifecycle', 'field_naming_reference', 'external_uuids'],
    keywords: ['invoice', 'send', 'approve', 'draft', 'customer', 'ar', 'payment'],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Resolve customer and product UUIDs.',
        toolName: 'COUNT_resolve_references',
        inputGuidance: 'customerName and/or product names; alternatively list_customers and list_products.',
      },
      {
        stepNumber: 2,
        instruction: 'Create the invoice in draft state.',
        toolName: 'COUNT_create_invoice',
        inputGuidance:
          'body: { customerUuid, date, products: [{ productUuid, quantity, unitPrice }], optional dueDate, tagUuids }.',
      },
      {
        stepNumber: 3,
        instruction: 'Approve the draft invoice (posts journals).',
        toolName: 'COUNT_approve_invoice',
        inputGuidance: 'id: invoice UUID from create response id field.',
      },
      {
        stepNumber: 4,
        instruction: 'Send the invoice to the customer.',
        toolName: 'COUNT_send_invoice',
        inputGuidance: 'id: same invoice UUID. Optional body recipients, subject, message, attachPdf.',
      },
      {
        stepNumber: 5,
        instruction: 'Optional — apply a bank deposit transaction as payment.',
        toolName: 'COUNT_assign_transaction_to_bills_invoices',
        inputGuidance:
          'id: Income transaction UUID. body: { matchingType: "invoice", records: [{ id: "<invoice-uuid>", paymentAmount }] }.',
      },
    ],
  },
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
    relatedPlaybookIds: ['setup_accounts_and_import_transactions', 'month_end_review'],
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
    id: 'budget_import',
    title: 'Export, edit, and re-import a P&L budget (Excel round-trip)',
    summary:
      'Export the budget grid as JSON, edit amounts offline, then bulk-import cell updates in ~25-row batches on a draft version.',
    relatedPlaybookIds: ['plan_budget_and_review_actuals', 'month_end_review'],
    relatedKnowledgeTopicIds: ['bulk_operations', 'external_uuids'],
    keywords: ['budget', 'import', 'export', 'excel', 'spreadsheet', 'forecast', 'planning'],
    steps: [
      {
        stepNumber: 1,
        instruction: 'List budgets or create a new draft budget for the planning period.',
        toolName: 'COUNT_list_budgets',
        inputGuidance: 'Optional query.status: draft. Or COUNT_create_budget with name, startPeriod, cadence, actualPeriods, budgetPeriods.',
      },
      {
        stepNumber: 2,
        instruction: 'Export the budget grid with account UUIDs and period columns.',
        toolName: 'COUNT_get_budget_grid',
        inputGuidance:
          'id: budget UUID. query: { includeActuals: "false", versionNumber: <draft version> } for faster budget-only export.',
      },
      {
        stepNumber: 3,
        instruction: 'Resolve account names to UUIDs when building import rows from a spreadsheet.',
        toolName: 'COUNT_resolve_references',
        inputGuidance: 'Pass accountName + accountType (Income or Expenses). Copy returned UUIDs into update rows.',
      },
      {
        stepNumber: 4,
        instruction: 'Preflight each import batch before writing cells.',
        toolName: 'COUNT_validate_payload',
        inputGuidance:
          'toolName: COUNT_bulk_update_budget_cells. body: { updates: [{ accountUuid, periodStart, amount }] }.',
      },
      {
        stepNumber: 5,
        instruction: 'Import edited amounts in batches (~25 rows; cap 100). Retry only failed indices.',
        toolName: 'COUNT_bulk_update_budget_cells',
        inputGuidance:
          'id + versionNumber + body.updates[]. Use periodStart values from get_budget_grid columns. Read errorCount first.',
      },
      {
        stepNumber: 6,
        instruction: 'Publish the budget when amounts are final.',
        toolName: 'COUNT_publish_budget',
        inputGuidance: 'id: budget UUID. Optional body.versionNumber for the draft version to publish.',
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
  {
    id: 'setup_accounts_and_import_transactions',
    title: 'Set up chart of accounts and import historical transactions',
    summary:
      'Confirm workspace scope, inventory existing accounts, create missing bank and category accounts, resolve references, preflight batches, bulk-import transactions or journal entries, then verify with a P&L report.',
    relatedPlaybookIds: ['migration_import', 'month_end_review'],
    relatedKnowledgeTopicIds: [
      'create_chart_of_accounts_account',
      'bulk_operations',
      'external_uuids',
      'multiple_workspaces',
    ],
    keywords: ['create account', 'chart of accounts', 'import', 'migration', 'setup', 'onboarding', 'coa', 'historical'],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Confirm which workspace you are setting up and importing into.',
        toolName: 'COUNT_auth_status',
        inputGuidance:
          'When multiple workspaces are authorized, also call COUNT_list_workspaces and pass workspace_id on every subsequent tool.',
      },
      {
        stepNumber: 2,
        instruction: 'Inventory existing bank/cash and Income/Expense category accounts for import mapping.',
        toolName: 'COUNT_list_accounts',
        inputGuidance:
          'query: { search: "<name fragment>", type: "Expenses" } for categories; query without type for bank/cash accounts. Copy id UUIDs for accUuid and categoryAccountUuid.',
      },
      {
        stepNumber: 3,
        instruction: 'Resolve subTypeId for each missing account type before creating accounts.',
        toolName: 'COUNT_list_account_sub_types',
        inputGuidance:
          'query.type filter: Assets (bank), Liabilities (credit card), Income, or Expenses. Pick the matching row and copy its integer id — never guess subTypeId values.',
      },
      {
        stepNumber: 4,
        instruction: 'Create missing bank, credit card, and category accounts in the chart of accounts.',
        toolName: 'COUNT_create_account',
        inputGuidance:
          'body: { name, subTypeId }. Optional parentAccountId for sub-accounts. Repeat for each account missing from step 2.',
      },
      {
        stepNumber: 5,
        instruction: 'Resolve vendor/customer/account names from the source system to UUIDs before building bulk rows.',
        toolName: 'COUNT_resolve_references',
        inputGuidance:
          'Pass vendorName, customerName, customerEmail, accountName, accountType as needed. Use returned UUIDs in bulk row bodies.',
      },
      {
        stepNumber: 6,
        instruction: 'Re-fetch account UUIDs for any accounts created in step 4.',
        toolName: 'COUNT_list_accounts',
        inputGuidance:
          'query: { search: "<account name>" } or list without filters. Copy id UUIDs for accUuid and categoryAccountUuid in import rows.',
      },
      {
        stepNumber: 7,
        instruction: 'Preflight each batch payload before calling a bulk create tool.',
        toolName: 'COUNT_validate_payload',
        inputGuidance:
          'toolName: COUNT_bulk_create_transactions or COUNT_bulk_create_journal_entries. Set verifyReferences: true to confirm UUIDs exist.',
      },
      {
        stepNumber: 8,
        instruction: 'Import in batches of ~25 rows (hard cap 100 per call). Retry only failed row indices.',
        toolName: 'COUNT_bulk_create_transactions',
        inputGuidance:
          'Bank register rows: COUNT_bulk_create_transactions with body.transactions[]. GL-only historical postings: COUNT_bulk_create_journal_entries instead. Read errorCount first; retry rows where success is false.',
      },
      {
        stepNumber: 9,
        instruction: 'Spot-check a sample of imported rows for dates, amounts, and categories.',
        toolName: 'COUNT_list_transactions',
        inputGuidance:
          'query filters for the imported date range. Use COUNT_get_transaction for individual row detail if needed.',
      },
      {
        stepNumber: 10,
        instruction: 'Sanity-check totals with a profit and loss report for the imported period.',
        toolName: 'COUNT_generate_profit_and_loss',
        inputGuidance: 'query: { startDate, endDate, basis: "accrual" } under top-level query key.',
      },
    ],
  },
  {
    id: 'plan_budget_and_review_actuals',
    title: 'Plan a budget and review actuals vs budget',
    summary:
      'Create or select a budget, populate draft amounts, publish, then compare actual vs budget columns in the grid and optionally drill into P&L.',
    relatedPlaybookIds: ['budget_import', 'month_end_review'],
    relatedKnowledgeTopicIds: ['budget_export_import', 'bulk_operations', 'external_uuids'],
    keywords: ['budget', 'forecast', 'planning', 'actuals', 'variance', 'vs budget', 'performance'],
    steps: [
      {
        stepNumber: 1,
        instruction: 'Check existing budgets or the workspace Overall Budget before creating a new plan.',
        toolName: 'COUNT_list_budgets',
        inputGuidance:
          'Optional query.status: draft or published. Alternatively COUNT_get_overall_budget to see if an Overall Budget is configured.',
      },
      {
        stepNumber: 2,
        instruction:
          'Use an existing draft budget from step 1, or create a new draft when none exists for the planning period.',
        toolName: 'COUNT_create_budget',
        inputGuidance:
          'Skip this step when list_budgets or get_overall_budget already returned a usable draft — carry that budget UUID and draft versionNumber forward to step 3. Only call create_budget when no draft exists: body { name, startPeriod, cadence, actualPeriods, budgetPeriods } with actualPeriods >= 1 so trailing actual columns appear in get_budget_grid for variance review.',
      },
      {
        stepNumber: 3,
        instruction: 'Export the budget grid structure for planning amounts (API review or Excel round-trip).',
        toolName: 'COUNT_get_budget_grid',
        inputGuidance:
          'id: budget UUID. query: { includeActuals: "false", versionNumber: <draft version> }. For Excel round-trip details, see playbook budget_import.',
      },
      {
        stepNumber: 4,
        instruction: 'Resolve account names to UUIDs when building import rows from a spreadsheet.',
        toolName: 'COUNT_resolve_references',
        inputGuidance: 'Pass accountName + accountType (Income or Expenses). Copy returned UUIDs into update rows.',
      },
      {
        stepNumber: 5,
        instruction: 'Preflight each import batch before writing budget cells.',
        toolName: 'COUNT_validate_payload',
        inputGuidance:
          'toolName: COUNT_bulk_update_budget_cells. body: { updates: [{ accountUuid, periodStart, amount }] }.',
      },
      {
        stepNumber: 6,
        instruction: 'Load planned amounts in batches (~25 rows; cap 100). Retry only failed indices.',
        toolName: 'COUNT_bulk_update_budget_cells',
        inputGuidance:
          'id + versionNumber + body.updates[]. Use periodStart values from get_budget_grid columns. Read errorCount first.',
      },
      {
        stepNumber: 7,
        instruction: 'Publish the budget when planned amounts are final.',
        toolName: 'COUNT_publish_budget',
        inputGuidance: 'id: budget UUID. Optional body.versionNumber for the draft version to publish.',
      },
      {
        stepNumber: 8,
        instruction: 'Review actuals vs budget by account and period in the published budget grid.',
        toolName: 'COUNT_get_budget_grid',
        inputGuidance:
          'id: budget UUID. query: { includeActuals: "true", versionNumber: <published version> }. Optional query.reportType: accrual or cash. Compare actual vs budget column values per account row.',
      },
      {
        stepNumber: 9,
        instruction: 'Optional — deep-dive actuals for a specific period or category with a P&L report.',
        toolName: 'COUNT_generate_profit_and_loss',
        inputGuidance: 'query: { startDate, endDate, basis: "accrual" } under top-level query key.',
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
