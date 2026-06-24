import { z } from 'zod';

export const PARTNER_ACCOUNT_TYPE_VALUES = [
  'Assets',
  'Liabilities',
  'Equity',
  'Income',
  'Expenses',
] as const;

export const PARTNER_TRANSACTION_TYPE_FILTER_VALUES = [
  'Expense',
  'Income',
  'Transfer',
  'Journal Entry',
] as const;

export const externalUuidSchema = z
  .string()
  .uuid()
  .describe('External COUNT UUID from a list/get tool response id field.');

export const workspaceIdSchema = z
  .string()
  .min(1)
  .optional()
  .describe(
    'External COUNT workspace UUID. Required when the connection can access more than one workspace; optional when only one workspace is authorized.',
  );

export const resourceIdSchema = z
  .string()
  .min(1)
  .describe('External COUNT UUID for the resource. Do not pass internal numeric IDs.');

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD.')
  .describe('Calendar date in YYYY-MM-DD format.');

export const pageSchema = z.coerce
  .number()
  .int('page must be an integer.')
  .positive('page must be a positive integer.')
  .optional()
  .describe('Page number for pagination (first page is 1).');

export const limitSchema = z.coerce
  .number()
  .int('limit must be an integer.')
  .positive('limit must be a positive integer.')
  .max(100, 'limit must be 100 or fewer.')
  .optional()
  .describe('Results per page (maximum 100).');

export const booleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .optional()
  .describe('Boolean filter — pass true/false or the strings "true"/"false".');

export const commaSeparatedUuidsSchema = z
  .union([
    z.string().regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(,[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})*$/i,
      'Must be a comma-separated list of UUIDs.',
    ),
    z.array(externalUuidSchema),
  ])
  .optional()
  .describe('Comma-separated UUID string or array of UUIDs.');

export const tagUuidsBodySchema = z
  .array(externalUuidSchema)
  .optional()
  .describe('Array of tag UUIDs from list_tags.');

export const transactionTypeFilterSchema = z
  .enum(PARTNER_TRANSACTION_TYPE_FILTER_VALUES)
  .optional()
  .describe('Filter by transaction type: Expense, Income, Transfer, or Journal Entry.');

export const partnerAccountTypeSchema = z
  .enum(PARTNER_ACCOUNT_TYPE_VALUES)
  .optional()
  .describe('Account type filter (case-sensitive, plural).');

export const paginationQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
});

export const searchQuerySchema = z.object({
  search: z.string().optional().describe('Free-text search string.'),
});

export const versionNumberSchema = z
  .union([z.string(), z.number()])
  .describe('Budget version number (integer, starting at 1).');
