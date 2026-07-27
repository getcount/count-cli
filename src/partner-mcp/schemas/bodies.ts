import { z } from 'zod';
import {
  externalUuidSchema,
  isoDateSchema,
  partnerNumericValueOptionalSchema,
  partnerNumericValueSchema,
  tagUuidsBodySchema,
  transactionTypeFilterSchema,
} from './primitives.js';

export const passthroughBodySchema = z
  .record(z.string(), z.unknown())
  .describe('JSON request body forwarded to the COUNT partner API. Use partner API field names.');

export const createTransactionBodySchema = z
  .object({
    accUuid: externalUuidSchema.describe('Bank/cash account UUID from list_accounts.'),
    amount: partnerNumericValueSchema.describe('Positive decimal amount — server applies sign by type.'),
    postedDate: isoDateSchema.optional(),
    date: isoDateSchema.optional().describe('Alias for postedDate.'),
    description: z.string().optional(),
    currency: z.string().optional(),
    type: transactionTypeFilterSchema.describe('Expense, Income, Transfer, or Journal Entry.'),
    categoryAccountUuid: externalUuidSchema
      .optional()
      .describe('Income/expense category account UUID — set at creation, not via update.'),
    vendorUuid: externalUuidSchema.optional(),
    customerUuid: externalUuidSchema.optional(),
    projectUuid: externalUuidSchema.optional(),
    tagUuids: tagUuidsBodySchema,
    taxes: z.array(z.number()).optional().describe('Internal numeric tax ids.'),
    notes: z.string().optional(),
    authorizedDate: isoDateSchema.optional(),
  })
  .passthrough()
  .refine((body) => body.postedDate != null || body.date != null, {
    message: 'Either postedDate or date is required.',
  });

export const bulkCreateTransactionsBodySchema = z.object({
  transactions: z
    .array(createTransactionBodySchema)
    .min(1)
    .max(100)
    .describe('Up to 100 transaction rows — same shape as create_transaction.'),
});

export const updateTransactionBodySchema = z
  .object({
    vendorUuid: externalUuidSchema.optional(),
    customerUuid: externalUuidSchema.optional(),
    projectUuid: externalUuidSchema.optional(),
    tagUuids: tagUuidsBodySchema,
    description: z.string().optional(),
    notes: z.string().optional(),
    amount: partnerNumericValueOptionalSchema,
    postedDate: isoDateSchema.optional(),
    authorizedDate: isoDateSchema.optional(),
  })
  .passthrough()
  .describe('Non-category transaction fields — use change_transaction_category for category changes.');

export const changeTransactionCategoryBodySchema = z
  .object({
    categoryAccountUuid: externalUuidSchema.nullable().describe('Category account UUID, or null to uncategorize.'),
    notes: z.string().optional(),
    taxes: z.array(z.number()).optional(),
    autoCreateMatching: z.boolean().optional(),
    autoReview: z.boolean().optional(),
    linkedTransferTransactionUuid: externalUuidSchema.optional(),
    fixedAssetAssignment: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const assignTransactionToBillsInvoicesBodySchema = z.object({
  matchingType: z.enum(['invoice', 'bill']).describe('Whether paying invoices or bills.'),
  records: z
    .array(
      z.object({
        id: externalUuidSchema.describe('Invoice or bill UUID.'),
        paymentAmount: z.union([z.number(), z.string()]),
        notes: z.string().optional(),
      }),
    )
    .min(1),
  withCaution: z.boolean().optional(),
  parentCategoryAccountUuid: externalUuidSchema.optional(),
});

export const excludeTransactionsBulkBodySchema = z.object({
  transactionUuids: z
    .array(externalUuidSchema)
    .min(1)
    .max(100)
    .describe('External transaction UUIDs from list_transactions or get_transaction.'),
  excluded: z.boolean().describe('true to exclude (hide from the ledger), false to un-exclude.'),
});

export const bulkChangeTransactionCategoryBodySchema = z.object({
  categoryAccountUuid: externalUuidSchema.nullable().describe('Category account UUID, or null to uncategorize.'),
  transactionUuids: z
    .array(externalUuidSchema)
    .min(1)
    .max(100)
    .describe('External transaction UUIDs from list_transactions or get_transaction.'),
});

const splitTransactionCategoryRowSchema = z
  .object({
    categoryAccountUuid: externalUuidSchema.optional(),
    amount: partnerNumericValueOptionalSchema,
    assignThis: z.boolean().optional(),
    originalAmount: partnerNumericValueOptionalSchema,
    type: transactionTypeFilterSchema.optional(),
  })
  .passthrough();

export const splitTransactionBodySchema = z
  .object({
    forAttachment: z.boolean().optional().describe('When true, skips queue side effects used during bill/invoice attachment.'),
    splitASplit: z.boolean().optional().describe('When true, splits an existing split child row.'),
    withCaution: z.boolean().optional().describe('Required to split reconciled transactions.'),
    parent: splitTransactionCategoryRowSchema.optional(),
    splits: z.array(splitTransactionCategoryRowSchema).optional(),
  })
  .passthrough()
  .describe('Split a transaction into a parent row plus child rows before bill/invoice assignment.');

export const setOpeningBalanceBodySchema = z.object({
  rows: z
    .array(
      z.object({
        accountUuid: externalUuidSchema.describe('External account UUID from list_accounts.'),
        debit: partnerNumericValueSchema.describe('Opening debit amount for this account (0 if none).'),
        credit: partnerNumericValueSchema.describe('Opening credit amount for this account (0 if none).'),
      })
    )
    .min(1)
    .describe('Opening balance rows. Total debits must equal total credits across all rows.'),
  replaceExisting: z
    .boolean()
    .optional()
    .describe(
      'Required (true) to overwrite an existing draft or published opening balance for this workspace. Omitted/false rejects with 409 if one already exists — use get_opening_balance to check first.'
    ),
});

export const createReconciliationBodySchema = z.object({
  accountUuid: externalUuidSchema.describe('External account UUID from list_accounts.'),
  endingBalanceDate: isoDateSchema.describe('Bank/statement ending date for this reconciliation period (YYYY-MM-DD).'),
  endingBalanceAmount: partnerNumericValueSchema.describe('Statement ending balance for the account.'),
});

export const completeReconciliationBodySchema = z.object({
  autoReconcile: z
    .boolean()
    .optional()
    .describe(
      'When true, also marks unreviewed journal entries in the period as reviewed and reconciles them. Defaults to false, which only reconciles entries already marked reviewed.'
    ),
});

export const updateWorkspaceBodySchema = z.object({
  cutoverDate: isoDateSchema.describe(
    'New workspace cutover date (YYYY-MM-DD). Moving it forward is only allowed when the workspace has no posted journal entries yet.'
  ),
});

export const createAccountBodySchema = z
  .object({
    name: z.string().min(1).describe('Account display name.'),
    subTypeId: z.number().int().positive().describe('Integer sub-type id from list_account_sub_types.'),
    accountNumber: z.string().optional(),
    currency: z.string().optional(),
    description: z.string().optional(),
    color: z.string().optional(),
    parentAccountId: z.number().int().optional(),
    institutionId: z.number().int().optional(),
    taxes: z.array(z.number()).optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .passthrough();

export const updateAccountBodySchema = createAccountBodySchema.partial().passthrough();

export const bulkCreateAccountsBodySchema = z.object({
  accounts: z
    .array(createAccountBodySchema)
    .min(1)
    .max(100)
    .describe('Up to 100 account rows — same shape as create_account.'),
});

export const createCustomerBodySchema = z
  .object({
    customer: z.string().min(1).describe('Business or person name.'),
    email: z.string().optional(),
    mainPhone: z.string().optional(),
    website: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    paymentTerm: z.string().optional(),
    taxNumber: z.string().optional(),
    taxAutoCalculate: z.boolean().optional(),
    taxExcluded: z.boolean().optional(),
    taxes: z.array(z.number()).optional(),
    billingAddress: z.record(z.string(), z.unknown()).optional(),
    shippingAddress: z.record(z.string(), z.unknown()).optional(),
    contacts: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

export const bulkCreateCustomersBodySchema = z.object({
  customers: z.array(createCustomerBodySchema).min(1).max(100),
});

export const bulkUpdateCustomersBodySchema = z.object({
  customers: z
    .array(
      createCustomerBodySchema.partial().extend({
        uuid: externalUuidSchema.describe('Customer UUID to update.'),
      }),
    )
    .min(1)
    .max(100),
});

export const createBillLineItemSchema = z.object({
  categoryAccountUuid: externalUuidSchema.describe('Expense category account UUID from list_accounts.'),
  description: z.string().optional(),
  quantity: partnerNumericValueSchema,
  price: partnerNumericValueSchema,
  total: partnerNumericValueOptionalSchema,
  taxes: z.array(z.number()).optional(),
  projectUuid: externalUuidSchema.optional(),
  customerUuid: externalUuidSchema.optional(),
});

export const createBillBodySchema = z.object({
  vendorUuid: externalUuidSchema.describe('Vendor UUID from list_vendors.'),
  date: isoDateSchema,
  dueDate: isoDateSchema,
  lineItems: z.array(createBillLineItemSchema).min(1),
  billNumber: z.string().optional(),
  purchaseOrderNumber: z.string().optional(),
  notes: z.string().optional(),
  currency: z.string().optional(),
  attachments: z.array(z.object({ url: z.string(), title: z.string().optional() })).optional(),
  tagUuids: tagUuidsBodySchema,
  projectUuid: externalUuidSchema.optional(),
});

export const updateBillBodySchema = createBillBodySchema.partial().passthrough();

export const applyVendorMemosToBillBodySchema = z.object({
  memosBills: z
    .array(
      z.object({
        id: externalUuidSchema.describe('Vendor memo bill UUID.'),
        amount: z.union([z.number(), z.string()]),
      }),
    )
    .min(1),
});

export const unassignBillTransactionBodySchema = z.object({
  transactionId: externalUuidSchema.describe('Transaction UUID from list_transactions.'),
  withCaution: z.boolean().optional(),
});

export const invoiceProductLineSchema = z
  .object({
    productUuid: externalUuidSchema.optional().describe('Product UUID from list_products.'),
    uuid: externalUuidSchema.optional().describe('Alias for productUuid.'),
    quantity: partnerNumericValueSchema,
    unitPrice: partnerNumericValueSchema,
  })
  .refine((_line) => _line.productUuid != null || _line.uuid != null, {
    message: 'Each product line requires productUuid or uuid from list_products.',
    path: ['productUuid'],
  });

export const createInvoiceBodyObjectSchema = z.object({
  customerUuid: externalUuidSchema,
  date: isoDateSchema,
  products: z.array(invoiceProductLineSchema).min(1),
  invoiceType: z.enum(['invoice', 'estimate', 'memo']).optional(),
  invoiceNumber: z.string().optional(),
  dueDate: isoDateSchema.optional(),
  currency: z.string().optional(),
  discount: z.union([z.number(), z.string()]).optional(),
  discountDescription: z.string().optional(),
  notes: z.string().optional(),
  tagUuids: tagUuidsBodySchema,
  appliedToInvoiceUuid: externalUuidSchema.optional(),
  isDraft: z.boolean().optional(),
});

export const createInvoiceBodySchema = createInvoiceBodyObjectSchema.passthrough();

export const recurrencePatternSchema = z
  .string()
  .min(1)
  .describe(
    'Schedule cadence: daily, weekly, biweekly, monthly, quarterly, or yearly. Aliases like bi-weekly are normalized server-side.',
  );

export const createRecurringInvoiceTemplateBodySchema = createInvoiceBodyObjectSchema
  .extend({
    recurrencePattern: recurrencePatternSchema,
    inAdvanceCreationDays: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Days before each scheduled date to generate the next invoice instance.'),
    recurrenceInterval: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Repeat every N recurrencePattern units (defaults to 1).'),
  })
  .passthrough();

export const sendInvoiceBodySchema = z.object({
  recipients: z.array(z.string()).optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
  attachPdf: z.boolean().optional(),
  cc: z.array(z.string()).optional(),
  bcc: z.array(z.string()).optional(),
});

export const invoiceAttachmentsBodySchema = z.object({
  attachments: z.array(z.object({ url: z.string(), title: z.string().optional() })).min(1),
});

export const applyMultipleCreditsToInvoiceBodySchema = z.object({
  creditMemos: z
    .array(
      z.object({
        id: externalUuidSchema,
        amount: z.union([z.number(), z.string()]),
      }),
    )
    .min(1),
});

export const applyCreditToMultipleInvoicesBodySchema = z.object({
  invoices: z
    .array(
      z.object({
        id: externalUuidSchema,
        amount: z.union([z.number(), z.string()]),
      }),
    )
    .min(1),
});

export const removeInvoiceCreditBodySchema = z.object({
  memoId: externalUuidSchema,
});

export const removeInvoiceTransactionBodySchema = z.object({
  transactionId: externalUuidSchema,
  withCaution: z.boolean().optional(),
});

export const journalEntryLineSchema = z
  .object({
    accountUuid: externalUuidSchema.describe('Account UUID from list_accounts.'),
    amountDebit: z.union([z.number(), z.string()]).optional(),
    amountCredit: z.union([z.number(), z.string()]).optional(),
    descriptionLine: z.string().optional(),
  })
  .refine(
    (line) =>
      (line.amountDebit != null && line.amountCredit == null) ||
      (line.amountCredit != null && line.amountDebit == null),
    { message: 'Each line needs exactly one of amountDebit or amountCredit.' },
  );

export const createJournalEntryBodySchema = z.object({
  descriptionEntry: z.string().min(1),
  date: isoDateSchema,
  lines: z.array(journalEntryLineSchema).min(2),
  refNumber: z.string().optional(),
  withCaution: z.boolean().optional(),
});

export const updateJournalEntryBodySchema = z
  .object({
    descriptionEntry: z.string().min(1).optional().describe('Updated posting memo.'),
    date: isoDateSchema.optional().describe('Updated posting date (YYYY-MM-DD).'),
    lines: z
      .array(journalEntryLineSchema)
      .min(2)
      .optional()
      .describe('Full replacement lines array when updating line items.'),
    refNumber: z.string().optional().describe('Updated reference number.'),
    withCaution: z.boolean().optional().describe('Skip book-closeness checks when true.'),
  })
  .refine(
    (body) =>
      body.descriptionEntry != null ||
      body.date != null ||
      body.lines != null ||
      body.refNumber != null ||
      body.withCaution != null,
    { message: 'Provide at least one field to update.' },
  );

export const bulkCreateJournalEntriesBodySchema = z.object({
  journalEntries: z.array(createJournalEntryBodySchema).min(1).max(100),
});

export const createProjectBodySchema = z.object({
  name: z.string().min(1),
  customerUuid: externalUuidSchema.nullable().optional(),
  statusUuid: externalUuidSchema.optional(),
  description: z.string().optional(),
  customId: z.string().optional(),
  startDate: isoDateSchema.optional(),
  endDate: isoDateSchema.optional(),
});

export const createTimeEntryRowSchema = z.object({
  date: isoDateSchema,
  minutes: z.number().int().positive(),
  description: z.string().optional(),
  projectUuid: externalUuidSchema.optional(),
  customerUuid: externalUuidSchema.optional(),
  productServiceUuid: externalUuidSchema.optional(),
  billable: z.boolean().optional(),
  wage: z.union([z.number(), z.string()]).optional(),
});

export const createTimeEntryBodySchema = z.object({
  peopleUuid: externalUuidSchema,
  timeEntries: z.array(createTimeEntryRowSchema).min(1),
});

export const budgetCellUpdateSchema = z.object({
  accountUuid: externalUuidSchema,
  periodStart: isoDateSchema,
  amount: z.union([z.number(), z.string()]),
});

export const updateBudgetCellsBodySchema = z.object({
  updates: z.array(budgetCellUpdateSchema).min(1).max(100),
});

export const createBudgetBodySchema = z.object({
  name: z.string().min(1),
  startPeriod: isoDateSchema,
  cadence: z.enum(['monthly', 'yearly']),
  actualPeriods: z.number().int().min(0),
  budgetPeriods: z.number().int().min(1),
  currencyCode: z.string().optional(),
  isOverall: z.boolean().optional(),
});

export const duplicateBudgetBodySchema = z.object({
  newName: z.string().min(1),
  carryValues: z.boolean().optional(),
  isOverall: z.boolean().optional(),
  versionNumber: z.union([z.string(), z.number()]).optional(),
});

export const publishBudgetBodySchema = z.object({
  versionNumber: z.union([z.string(), z.number()]).optional(),
});

export const createBudgetVersionBodySchema = z.object({
  label: z.string().optional(),
});

export const matchExpenseReceiptBodySchema = z.object({
  transactionUuid: externalUuidSchema,
});

export const createTagGroupBodySchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  tagUuids: tagUuidsBodySchema,
});

export const createTaskBodySchema = z
  .object({
    type: z.string().min(1).describe('Task type identifier.'),
    name: z.string().optional(),
    description: z.string().optional(),
    priority: z.string().optional(),
    deadline: isoDateSchema.optional(),
    customId: z.string().optional(),
    visibility: z.enum(['firm-team', 'team-only', 'firm-only']).optional(),
    assigneeId: z.union([externalUuidSchema, z.number()]).optional(),
    statusId: z.union([externalUuidSchema, z.number()]).optional(),
    projectId: z.union([externalUuidSchema, z.number()]).optional(),
    tags: z.union([z.array(z.union([externalUuidSchema, z.number()])), z.string()]).optional(),
  })
  .passthrough();

export const createProductBodySchema = z
  .object({
    name: z.string().optional(),
    categoryAccountUuid: externalUuidSchema.optional(),
    purchaseCategoryAccountUuid: externalUuidSchema.optional(),
    taxUuids: z.array(externalUuidSchema).optional(),
  })
  .passthrough();

export const createVendorBodySchema = z
  .object({
    vendor: z.string().min(1).optional().describe('Vendor display name (alias for name).'),
    name: z.string().min(1).optional().describe('Vendor display name.'),
    email: z.string().optional(),
  })
  .passthrough()
  .refine((body) => Boolean(body.name?.trim()) || Boolean(body.vendor?.trim()), {
    message: 'Either name or vendor is required.',
  });

export const createTagBodySchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
});

export const emptyOptionalBodySchema = z.object({}).passthrough();
