import { z } from 'zod';
import {
  booleanQuerySchema,
  commaSeparatedUuidsSchema,
  externalUuidSchema,
  isoDateSchema,
  paginationQuerySchema,
  partnerAccountTypeSchema,
  searchQuerySchema,
  transactionTypeFilterSchema,
} from './primitives.js';

export const emptyQuerySchema = z.object({}).describe('No query filters.');

export const paginationSearchQuerySchema = paginationQuerySchema.merge(searchQuerySchema);

export const listTransactionsQuerySchema = paginationQuerySchema
  .merge(searchQuerySchema)
  .extend({
    accUuid: externalUuidSchema.optional().describe('Filter by bank/cash account UUID.'),
    accountUuid: externalUuidSchema.optional().describe('Alias for accUuid.'),
    categoryAccountUuid: externalUuidSchema.optional().describe('Filter by category account UUID.'),
    vendorUuid: externalUuidSchema.optional().describe('Filter by vendor UUID.'),
    customerUuid: externalUuidSchema.optional().describe('Filter by customer UUID.'),
    projectUuid: externalUuidSchema.optional().describe('Filter by project UUID.'),
    tagUuids: commaSeparatedUuidsSchema.describe('Comma-separated tag UUIDs or array.'),
    startDate: isoDateSchema.optional().describe('Filter postedDate from this date (inclusive).'),
    endDate: isoDateSchema.optional().describe('Filter postedDate through this date (inclusive).'),
    transactionTypes: transactionTypeFilterSchema,
    type: transactionTypeFilterSchema.describe('Alias for transactionTypes — use one or the other, not both.'),
    reviewed: booleanQuerySchema.describe('Filter by review status.'),
    reconciled: booleanQuerySchema.describe('Filter by reconciliation status.'),
  })
  .describe('List transaction filters.');

export const getTransactionQuerySchema = z
  .object({
    include: z.string().optional().describe('Sequelize include directives to expand related entities.'),
  })
  .passthrough()
  .describe('Optional include expansions for a single transaction.');

export const listAccountSubTypesQuerySchema = z
  .object({
    type: partnerAccountTypeSchema.describe(
      'Filter sub-types by account type: Assets, Liabilities, Equity, Income, Expenses.',
    ),
  })
  .describe('Account sub-type catalog filters.');

export const listAccountsQuerySchema = z
  .object({
    type: partnerAccountTypeSchema,
    subTypeId: z.coerce.number().int().positive().optional().describe('Filter by sub-type integer id.'),
    search: z.string().max(200).optional().describe('Substring match against account name or number.'),
    inactive: booleanQuerySchema,
    includeBalances: booleanQuerySchema,
    includeHidden: booleanQuerySchema,
    includeHiddenAccounts: booleanQuerySchema,
    is1099Box: booleanQuerySchema,
    notAssignedToReporter: booleanQuerySchema,
    onlyCategoryAccounts: booleanQuerySchema,
    includeDeleteMeta: booleanQuerySchema,
  })
  .passthrough()
  .describe('Chart of accounts list filters.');

export const listBillsQuerySchema = paginationQuerySchema.merge(searchQuerySchema).extend({
  orderBy: z.string().optional().describe('Sort field name.'),
  orderDirection: z.enum(['asc', 'desc']).optional().describe('Sort direction.'),
  projectUuids: commaSeparatedUuidsSchema.describe('Comma-separated project UUIDs.'),
  vendorUuids: commaSeparatedUuidsSchema.describe('Comma-separated vendor UUIDs from list_vendors.'),
  approvalStatus: z.string().optional().describe('Filter by approval status (e.g. draft, approved).'),
  status: z.string().optional().describe('Comma-separated approval/payment status tokens.'),
  billType: z.enum(['bill', 'vendor_memo']).optional().describe('Bill type filter.'),
  currency: z.string().optional().describe('ISO currency code filter.'),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  startDueDate: isoDateSchema.optional(),
  endDueDate: isoDateSchema.optional(),
  amount: z.coerce.number().optional().describe('Amount filter value.'),
  amountOperator: z.enum(['eq', 'gte', 'lte', 'gt', 'lt']).optional().describe('Amount comparison operator.'),
});

export const listInvoicesQuerySchema = paginationSearchQuerySchema.extend({
  status: z.string().optional().describe('Comma-separated lifecycle statuses (e.g. draft,approved,sent).'),
  approvalStatus: z.enum(['draft', 'approved']).optional(),
  customerUuid: externalUuidSchema.optional(),
  customerUuids: commaSeparatedUuidsSchema,
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
  invoiceType: z.enum(['invoice', 'estimate', 'memo']).optional(),
  isDraft: booleanQuerySchema,
});

export const listProjectsQuerySchema = paginationSearchQuerySchema.extend({
  customerUuids: commaSeparatedUuidsSchema.describe('Comma-separated customer UUIDs.'),
  statusUuids: commaSeparatedUuidsSchema.describe('Comma-separated project status UUIDs from list_project_statuses.'),
});

export const listTasksQuerySchema = paginationQuerySchema.extend({
  orderBy: z.string().optional(),
  orderDirection: z.enum(['asc', 'desc']).optional(),
  search: z.string().optional(),
  customId: z.string().optional(),
  visibility: z.enum(['firm-team', 'team-only', 'firm-only']).optional(),
  priority: z.string().optional(),
  overduesOnly: booleanQuerySchema,
  deadlineDate: isoDateSchema.optional(),
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
  status: z.string().optional(),
  statusId: z.string().optional().describe('Comma-separated task status UUIDs or numeric ids.'),
  assigneeId: z.string().optional(),
  assignerId: z.string().optional(),
  createdById: z.string().optional(),
  projects: z.string().optional().describe('Comma-separated project UUIDs or numeric ids.'),
  commentId: z.string().optional(),
});

export const listProjectTasksQuerySchema = paginationSearchQuerySchema;

export const listTimeEntriesQuerySchema = paginationQuerySchema.extend({
  peopleUuids: commaSeparatedUuidsSchema,
  projectUuids: commaSeparatedUuidsSchema,
  customerUuids: commaSeparatedUuidsSchema,
  productServiceUuids: commaSeparatedUuidsSchema,
  startDate: isoDateSchema.optional().describe('Created-at range start — requires endDate too.'),
  endDate: isoDateSchema.optional().describe('Created-at range end — requires startDate too.'),
});

export const listBudgetsQuerySchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional().describe('Filter budgets by status.'),
});

export const getBudgetGridQuerySchema = z.object({
  versionNumber: z.union([z.string(), z.number()]).optional().describe('Budget version number (defaults to latest).'),
  reportType: z.enum(['accrual', 'cash']).optional(),
  includeActuals: booleanQuerySchema.describe('Set false for budget-only export.'),
});

export const trialBalanceReportQuerySchema = z.object({
  endDate: isoDateSchema.describe('Required as-of date (YYYY-MM-DD).'),
  startDate: isoDateSchema.optional().describe('Optional period start (defaults to fiscal-year start).'),
  currency: z.string().optional(),
  transactionStatus: z
    .enum(['all', 'reviewed', 'unreviewed', 'reconciled', 'unreconciled'])
    .optional(),
  accounts: commaSeparatedUuidsSchema.describe('Comma-separated account UUIDs.'),
  accountUuids: commaSeparatedUuidsSchema.describe('Alias for accounts.'),
  tags: commaSeparatedUuidsSchema,
  tagUuids: commaSeparatedUuidsSchema,
  noTags: booleanQuerySchema,
  accountType: partnerAccountTypeSchema,
});

export const profitAndLossReportQuerySchema = z.object({
  startDate: isoDateSchema.describe('Required period start (YYYY-MM-DD).'),
  endDate: isoDateSchema.describe('Required period end (YYYY-MM-DD).'),
  currency: z.string().optional(),
  transactionStatus: z
    .enum(['all', 'reviewed', 'unreviewed', 'reconciled', 'unreconciled'])
    .optional(),
  categoryAccount: externalUuidSchema.optional(),
  categoryAccountUuid: externalUuidSchema.optional(),
  categoryAccountUuids: commaSeparatedUuidsSchema,
  tags: commaSeparatedUuidsSchema,
  tagUuids: commaSeparatedUuidsSchema,
  customers: commaSeparatedUuidsSchema,
  customerUuids: commaSeparatedUuidsSchema,
  vendors: commaSeparatedUuidsSchema,
  vendorUuids: commaSeparatedUuidsSchema,
  projects: commaSeparatedUuidsSchema,
  projectUuids: commaSeparatedUuidsSchema,
  products: commaSeparatedUuidsSchema,
  productUuids: commaSeparatedUuidsSchema,
  isPnLByTag: booleanQuerySchema,
  includeNoTag: booleanQuerySchema,
  reportYear: z.enum(['financial', 'calendar']).optional(),
});

export const balanceSheetReportQuerySchema = z.object({
  endDate: isoDateSchema.describe('Required as-of date (YYYY-MM-DD).'),
  startDate: isoDateSchema.optional(),
  currency: z.string().optional(),
  transactionStatus: z
    .enum(['all', 'reviewed', 'unreviewed', 'reconciled', 'unreconciled'])
    .optional(),
  accounts: commaSeparatedUuidsSchema,
  accountUuids: commaSeparatedUuidsSchema,
  tags: commaSeparatedUuidsSchema,
  tagUuids: commaSeparatedUuidsSchema,
});

export const workspaceStatsQuerySchema = z.object({
  include: z
    .string()
    .optional()
    .describe(
      'Comma-separated blocks: workspace,cash,profitability,receivables,payables,taxObligations,connections. Omit for all.',
    ),
});

export const getTaskQuerySchema = z.object({
  visibility: z.enum(['firm-team', 'team-only', 'firm-only']).optional(),
});
