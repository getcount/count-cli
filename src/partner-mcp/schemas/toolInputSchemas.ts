import { z } from 'zod';
import {
  applyCreditToMultipleInvoicesBodySchema,
  applyMultipleCreditsToInvoiceBodySchema,
  applyVendorMemosToBillBodySchema,
  assignTransactionToBillsInvoicesBodySchema,
  bulkChangeTransactionCategoryBodySchema,
  bulkCreateCustomersBodySchema,
  bulkCreateAccountsBodySchema,
  bulkCreateJournalEntriesBodySchema,
  bulkCreateTransactionsBodySchema,
  bulkUpdateCustomersBodySchema,
  changeTransactionCategoryBodySchema,
  completeReconciliationBodySchema,
  createReconciliationBodySchema,
  createAccountBodySchema,
  createBillBodySchema,
  createBudgetBodySchema,
  createBudgetVersionBodySchema,
  createCustomerBodySchema,
  createInvoiceBodySchema,
  createRecurringInvoiceTemplateBodySchema,
  createJournalEntryBodySchema,
  updateJournalEntryBodySchema,
  createProductBodySchema,
  createProjectBodySchema,
  createTagBodySchema,
  createTagGroupBodySchema,
  createTaskBodySchema,
  createTimeEntryBodySchema,
  createTransactionBodySchema,
  createVendorBodySchema,
  duplicateBudgetBodySchema,
  emptyOptionalBodySchema,
  invoiceAttachmentsBodySchema,
  matchExpenseReceiptBodySchema,
  passthroughBodySchema,
  publishBudgetBodySchema,
  removeInvoiceCreditBodySchema,
  removeInvoiceTransactionBodySchema,
  sendInvoiceBodySchema,
  setOpeningBalanceBodySchema,
  splitTransactionBodySchema,
  excludeTransactionsBulkBodySchema,
  unassignBillTransactionBodySchema,
  updateAccountBodySchema,
  updateBillBodySchema,
  updateBudgetCellsBodySchema,
  updateTransactionBodySchema,
  updateWorkspaceBodySchema,
} from './bodies.js';
import {
  buildBodyToolInputSchema,
  buildEmptyToolInputSchema,
  buildIdBodyToolInputSchema,
  buildIdQueryToolInputSchema,
  buildIdVersionNumberBodyToolInputSchema,
  buildQueryToolInputSchema,
} from './builders.js';
import {
  balanceSheetReportQuerySchema,
  emptyQuerySchema,
  getBudgetGridQuerySchema,
  getTaskQuerySchema,
  getTransactionQuerySchema,
  listAccountSubTypesQuerySchema,
  listAccountsQuerySchema,
  listBillsQuerySchema,
  listBudgetsQuerySchema,
  listInvoicesQuerySchema,
  listProjectTasksQuerySchema,
  listProjectsQuerySchema,
  listRecurringInvoiceTemplatesQuerySchema,
  listTasksQuerySchema,
  listTimeEntriesQuerySchema,
  listTransactionsQuerySchema,
  paginationSearchQuerySchema,
  profitAndLossReportQuerySchema,
  trialBalanceReportQuerySchema,
  workspaceStatsQuerySchema,
} from './queries.js';
import {
  describeEndpointInputSchema,
  emptyInputSchema,
  knowledgeInputSchema,
  playbooksInputSchema,
  resolveReferencesInputSchema,
  validatePayloadInputSchema,
} from '../tools/schemas.js';

const listPaginationQuerySchema = buildQueryToolInputSchema({
  queryObjectSchema: paginationSearchQuerySchema,
});

const genericListQuerySchema = buildQueryToolInputSchema({
  queryObjectSchema: emptyQuerySchema.passthrough() as z.ZodObject<z.ZodRawShape>,
});

const genericBodySchema = buildBodyToolInputSchema({
  bodyObjectSchema: passthroughBodySchema,
});

const genericIdBodySchema = buildIdBodyToolInputSchema({
  bodyObjectSchema: passthroughBodySchema,
});

const genericIdOptionalBodySchema = buildIdBodyToolInputSchema({
  bodyObjectSchema: emptyOptionalBodySchema,
  optionalBody: true,
});

const genericIdSchema = buildIdQueryToolInputSchema();

const TOOL_INPUT_SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  COUNT_auth_status: emptyInputSchema,
  COUNT_describe_endpoint: describeEndpointInputSchema,
  COUNT_knowledge: knowledgeInputSchema,
  COUNT_playbooks: playbooksInputSchema,
  COUNT_resolve_references: resolveReferencesInputSchema,
  COUNT_validate_payload: validatePayloadInputSchema,
  COUNT_refresh_access_token: buildEmptyToolInputSchema(),

  COUNT_list_transactions: buildQueryToolInputSchema({ queryObjectSchema: listTransactionsQuerySchema }),
  COUNT_get_transaction: buildIdQueryToolInputSchema({ queryObjectSchema: getTransactionQuerySchema }),
  COUNT_create_transaction: buildBodyToolInputSchema({ bodyObjectSchema: createTransactionBodySchema }),
  COUNT_bulk_create_transactions: buildBodyToolInputSchema({ bodyObjectSchema: bulkCreateTransactionsBodySchema }),
  COUNT_update_transaction: buildIdBodyToolInputSchema({ bodyObjectSchema: updateTransactionBodySchema }),
  COUNT_change_transaction_category: buildIdBodyToolInputSchema({
    bodyObjectSchema: changeTransactionCategoryBodySchema,
  }),
  COUNT_assign_transaction_to_bills_invoices: buildIdBodyToolInputSchema({
    bodyObjectSchema: assignTransactionToBillsInvoicesBodySchema,
  }),
  COUNT_split_transaction: buildIdBodyToolInputSchema({
    bodyObjectSchema: splitTransactionBodySchema,
  }),
  COUNT_delete_transaction: genericIdSchema,
  COUNT_bulk_exclude_transactions: buildBodyToolInputSchema({ bodyObjectSchema: excludeTransactionsBulkBodySchema }),
  COUNT_bulk_change_transaction_category: buildBodyToolInputSchema({
    bodyObjectSchema: bulkChangeTransactionCategoryBodySchema,
  }),

  COUNT_list_account_sub_types: buildQueryToolInputSchema({ queryObjectSchema: listAccountSubTypesQuerySchema }),
  COUNT_list_accounts: buildQueryToolInputSchema({ queryObjectSchema: listAccountsQuerySchema }),
  COUNT_create_account: buildBodyToolInputSchema({ bodyObjectSchema: createAccountBodySchema }),
  COUNT_bulk_create_accounts: buildBodyToolInputSchema({ bodyObjectSchema: bulkCreateAccountsBodySchema }),
  COUNT_update_account: buildIdBodyToolInputSchema({ bodyObjectSchema: updateAccountBodySchema }),
  COUNT_delete_account: genericIdSchema,

  COUNT_list_vendors: listPaginationQuerySchema,
  COUNT_create_vendor: buildBodyToolInputSchema({ bodyObjectSchema: createVendorBodySchema }),
  COUNT_update_vendor: genericIdBodySchema,
  COUNT_delete_vendor: genericIdSchema,

  COUNT_list_customers: listPaginationQuerySchema,
  COUNT_get_customer: genericIdSchema,
  COUNT_create_customer: buildBodyToolInputSchema({ bodyObjectSchema: createCustomerBodySchema }),
  COUNT_update_customer: genericIdBodySchema,
  COUNT_bulk_create_customers: buildBodyToolInputSchema({ bodyObjectSchema: bulkCreateCustomersBodySchema }),
  COUNT_bulk_update_customers: buildBodyToolInputSchema({ bodyObjectSchema: bulkUpdateCustomersBodySchema }),
  COUNT_delete_customer: genericIdSchema,

  COUNT_list_people: listPaginationQuerySchema,
  COUNT_get_person: genericIdSchema,

  COUNT_list_products: listPaginationQuerySchema,
  COUNT_get_product: genericIdSchema,
  COUNT_create_product: buildBodyToolInputSchema({ bodyObjectSchema: createProductBodySchema }),
  COUNT_update_product: genericIdBodySchema,
  COUNT_delete_product: genericIdSchema,

  COUNT_list_tags: listPaginationQuerySchema,
  COUNT_get_tag: genericIdSchema,
  COUNT_create_tag: buildBodyToolInputSchema({ bodyObjectSchema: createTagBodySchema }),
  COUNT_update_tag: genericIdBodySchema,
  COUNT_delete_tag: genericIdSchema,

  COUNT_list_tag_groups: listPaginationQuerySchema,
  COUNT_get_tag_group: genericIdSchema,
  COUNT_create_tag_group: buildBodyToolInputSchema({ bodyObjectSchema: createTagGroupBodySchema }),
  COUNT_update_tag_group: genericIdBodySchema,
  COUNT_delete_tag_group: genericIdSchema,

  COUNT_list_invoices: buildQueryToolInputSchema({ queryObjectSchema: listInvoicesQuerySchema }),
  COUNT_get_invoice: genericIdSchema,
  COUNT_create_invoice: buildBodyToolInputSchema({ bodyObjectSchema: createInvoiceBodySchema }),
  COUNT_update_invoice: genericIdBodySchema,
  COUNT_delete_invoice: genericIdSchema,
  COUNT_approve_invoice: genericIdOptionalBodySchema,
  COUNT_send_invoice: buildIdBodyToolInputSchema({ bodyObjectSchema: sendInvoiceBodySchema, optionalBody: true }),
  COUNT_get_invoice_public_link: genericIdSchema,
  COUNT_get_invoice_audit_log: genericIdSchema,
  COUNT_add_invoice_attachments_from_urls: buildIdBodyToolInputSchema({
    bodyObjectSchema: invoiceAttachmentsBodySchema,
  }),
  COUNT_apply_multiple_credits_to_invoice: buildIdBodyToolInputSchema({
    bodyObjectSchema: applyMultipleCreditsToInvoiceBodySchema,
  }),
  COUNT_apply_credit_to_multiple_invoices: buildIdBodyToolInputSchema({
    bodyObjectSchema: applyCreditToMultipleInvoicesBodySchema,
  }),
  COUNT_remove_invoice_credit: buildIdBodyToolInputSchema({ bodyObjectSchema: removeInvoiceCreditBodySchema }),
  COUNT_remove_invoice_transaction: buildIdBodyToolInputSchema({
    bodyObjectSchema: removeInvoiceTransactionBodySchema,
  }),

  COUNT_list_recurring_invoice_templates: buildQueryToolInputSchema({
    queryObjectSchema: listRecurringInvoiceTemplatesQuerySchema,
  }),
  COUNT_get_recurring_invoice_template: genericIdSchema,
  COUNT_create_recurring_invoice_template: buildBodyToolInputSchema({
    bodyObjectSchema: createRecurringInvoiceTemplateBodySchema,
  }),
  COUNT_update_recurring_invoice_template: genericIdBodySchema,
  COUNT_delete_recurring_invoice_template: genericIdSchema,
  COUNT_pause_recurring_invoice_template: genericIdOptionalBodySchema,
  COUNT_resume_recurring_invoice_template: genericIdOptionalBodySchema,

  COUNT_list_bills: buildQueryToolInputSchema({ queryObjectSchema: listBillsQuerySchema }),
  COUNT_get_bill: genericIdSchema,
  COUNT_create_bill: buildBodyToolInputSchema({ bodyObjectSchema: createBillBodySchema }),
  COUNT_update_bill: buildIdBodyToolInputSchema({ bodyObjectSchema: updateBillBodySchema }),
  COUNT_delete_bill: genericIdSchema,
  COUNT_approve_bill: genericIdOptionalBodySchema,
  COUNT_apply_vendor_memos_to_bill: buildIdBodyToolInputSchema({ bodyObjectSchema: applyVendorMemosToBillBodySchema }),
  COUNT_unassign_bill_transaction: buildIdBodyToolInputSchema({ bodyObjectSchema: unassignBillTransactionBodySchema }),

  COUNT_list_journal_entries: listPaginationQuerySchema,
  COUNT_create_journal_entry: buildBodyToolInputSchema({ bodyObjectSchema: createJournalEntryBodySchema }),
  COUNT_bulk_create_journal_entries: buildBodyToolInputSchema({ bodyObjectSchema: bulkCreateJournalEntriesBodySchema }),
  COUNT_update_journal_entry: buildIdBodyToolInputSchema({ bodyObjectSchema: updateJournalEntryBodySchema }),
  COUNT_delete_journal_entry: genericIdSchema,

  COUNT_list_tasks: buildQueryToolInputSchema({ queryObjectSchema: listTasksQuerySchema }),
  COUNT_get_task: buildIdQueryToolInputSchema({ queryObjectSchema: getTaskQuerySchema }),
  COUNT_create_task: buildBodyToolInputSchema({ bodyObjectSchema: createTaskBodySchema }),
  COUNT_update_task: genericIdBodySchema,
  COUNT_delete_task: genericIdSchema,

  COUNT_list_projects: buildQueryToolInputSchema({ queryObjectSchema: listProjectsQuerySchema }),
  COUNT_list_project_statuses: genericListQuerySchema,
  COUNT_get_project: genericIdSchema,
  COUNT_list_project_tasks: buildIdQueryToolInputSchema({ queryObjectSchema: listProjectTasksQuerySchema }),
  COUNT_create_project: buildBodyToolInputSchema({ bodyObjectSchema: createProjectBodySchema }),
  COUNT_update_project: genericIdBodySchema,
  COUNT_delete_project: genericIdSchema,

  COUNT_list_time_entries: buildQueryToolInputSchema({ queryObjectSchema: listTimeEntriesQuerySchema }),
  COUNT_get_time_entry: genericIdSchema,
  COUNT_create_time_entry: buildBodyToolInputSchema({ bodyObjectSchema: createTimeEntryBodySchema }),
  COUNT_update_time_entry: genericIdBodySchema,
  COUNT_delete_time_entry: genericIdSchema,

  COUNT_list_expense_receipts: listPaginationQuerySchema,
  COUNT_list_unmatched_expense_receipts: listPaginationQuerySchema,
  COUNT_create_expense_receipt: genericBodySchema,
  COUNT_update_expense_receipt: genericIdBodySchema,
  COUNT_delete_expense_receipt: genericIdSchema,
  COUNT_match_expense_receipt_manually: buildIdBodyToolInputSchema({ bodyObjectSchema: matchExpenseReceiptBodySchema }),
  COUNT_unmatch_expense_receipt: genericIdSchema,

  COUNT_generate_trial_balance: buildQueryToolInputSchema({ queryObjectSchema: trialBalanceReportQuerySchema }),
  COUNT_generate_profit_and_loss: buildQueryToolInputSchema({ queryObjectSchema: profitAndLossReportQuerySchema }),
  COUNT_generate_balance_sheet: buildQueryToolInputSchema({ queryObjectSchema: balanceSheetReportQuerySchema }),

  COUNT_list_budgets: buildQueryToolInputSchema({ queryObjectSchema: listBudgetsQuerySchema }),
  COUNT_get_overall_budget: genericListQuerySchema,
  COUNT_create_budget: buildBodyToolInputSchema({ bodyObjectSchema: createBudgetBodySchema }),
  COUNT_get_budget: genericIdSchema,
  COUNT_update_budget: genericIdBodySchema,
  COUNT_get_budget_grid: buildIdQueryToolInputSchema({ queryObjectSchema: getBudgetGridQuerySchema }),
  COUNT_list_budget_versions: genericIdSchema,
  COUNT_update_budget_cells: buildIdVersionNumberBodyToolInputSchema({
    bodyObjectSchema: updateBudgetCellsBodySchema,
  }),
  COUNT_bulk_update_budget_cells: buildIdVersionNumberBodyToolInputSchema({
    bodyObjectSchema: updateBudgetCellsBodySchema,
  }),
  COUNT_create_budget_version: buildIdBodyToolInputSchema({
    bodyObjectSchema: createBudgetVersionBodySchema,
    optionalBody: true,
  }),
  COUNT_publish_budget: buildIdBodyToolInputSchema({ bodyObjectSchema: publishBudgetBodySchema, optionalBody: true }),
  COUNT_archive_budget: genericIdOptionalBodySchema,
  COUNT_duplicate_budget: buildIdBodyToolInputSchema({ bodyObjectSchema: duplicateBudgetBodySchema }),

  COUNT_get_workspace_stats: buildQueryToolInputSchema({ queryObjectSchema: workspaceStatsQuerySchema }),
  COUNT_update_workspace: buildBodyToolInputSchema({ bodyObjectSchema: updateWorkspaceBodySchema }),

  COUNT_get_opening_balance: buildEmptyToolInputSchema(),
  COUNT_set_opening_balance: buildBodyToolInputSchema({ bodyObjectSchema: setOpeningBalanceBodySchema }),

  COUNT_create_reconciliation: buildBodyToolInputSchema({ bodyObjectSchema: createReconciliationBodySchema }),
  COUNT_complete_reconciliation: buildIdBodyToolInputSchema({
    bodyObjectSchema: completeReconciliationBodySchema,
    optionalBody: true,
  }),
};

export interface ToolOutputShapeNote {
  description: string;
  example?: string;
}

export interface ToolMetadataEntry {
  commonErrors?: string[];
  responseShape?: ToolOutputShapeNote;
}

export const TOOL_METADATA: Record<string, ToolMetadataEntry> = {
  COUNT_bulk_create_transactions: {
    responseShape: {
      description:
        'Partial-success envelope: { successCount, errorCount, results: [{ index, success, transaction? | error? }] }. HTTP 201 when batch accepted. Row error is a plain string message.',
      example: JSON.stringify(
        {
          successCount: 1,
          errorCount: 1,
          results: [
            { index: 0, success: true, transaction: { id: 'uuid-here' } },
            { index: 1, success: false, error: 'Account sub type not found.' },
          ],
        },
        null,
        2,
      ),
    },
    commonErrors: [
      '400 — batch envelope invalid (>100 rows, missing transactions array).',
      '201 with errorCount > 0 — per-row validation; retry only failed indices.',
    ],
  },
  COUNT_bulk_create_customers: {
    responseShape: {
      description: 'Same bulk envelope with success row key customer.',
    },
  },
  COUNT_bulk_create_journal_entries: {
    responseShape: {
      description: 'Same bulk envelope with success row key journalEntry.',
    },
  },
  COUNT_bulk_update_budget_cells: {
    responseShape: {
      description: 'Same bulk envelope with success row key budgetCellUpdate.',
    },
  },
  COUNT_approve_invoice: {
    commonErrors: [
      '400 — invoice already approved, sent, or paid; or send called on draft.',
      '400 — cannot update approved invoice (use credit memo flow instead).',
    ],
  },
  COUNT_send_invoice: {
    commonErrors: ['400 — invoice must be approved before send.'],
  },
  COUNT_create_bill: {
    commonErrors: ['400 — vendorUuid or lineItems validation failure; check field_naming_reference topic.'],
  },
};

interface GetToolInputSchemaParams {
  toolName: string;
}

export function getToolInputSchema(params: GetToolInputSchemaParams): z.ZodType<Record<string, unknown>> {
  const { toolName } = params;
  return TOOL_INPUT_SCHEMAS[toolName] ?? genericBodySchema;
}

export function getToolMetadata(params: GetToolInputSchemaParams): ToolMetadataEntry | undefined {
  const { toolName } = params;
  return TOOL_METADATA[toolName];
}

export function listRegisteredToolInputSchemaNames(): string[] {
  return Object.keys(TOOL_INPUT_SCHEMAS);
}

export function isGenericPassthroughSchema(params: GetToolInputSchemaParams): boolean {
  const { toolName } = params;
  const schema = TOOL_INPUT_SCHEMAS[toolName];
  return schema === genericBodySchema || schema === genericIdBodySchema;
}

interface SummarizeToolInputSchemaParams {
  toolName: string;
}

export function summarizeToolInputSchema(params: SummarizeToolInputSchemaParams): string[] {
  const { toolName } = params;
  const schema = getToolInputSchema({ toolName });
  if (!(schema instanceof z.ZodObject)) {
    return ['See tool inputSchema via list_tools.'];
  }

  const shape = schema.shape;
  const summaryLines: string[] = [];

  for (const [fieldName, fieldSchema] of Object.entries(shape)) {
    const typedFieldSchema = fieldSchema as z.ZodTypeAny;
    const fieldDescription = typedFieldSchema.description;
    summaryLines.push(fieldDescription ? `${fieldName}: ${fieldDescription}` : fieldName);
  }

  return summaryLines.length > 0 ? summaryLines : ['No typed top-level fields.'];
}

export { TOOL_INPUT_SCHEMAS };
