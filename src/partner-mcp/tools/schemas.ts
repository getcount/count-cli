import { z } from 'zod';

const queryValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

export const querySchema = z
  .record(z.string(), queryValueSchema)
  .describe('Optional query parameters forwarded to the COUNT partner API.');

export const jsonBodySchema = z
  .record(z.string(), z.unknown())
  .describe('JSON request body forwarded to the COUNT partner API. Use partner API field names.');

export const emptyInputSchema = z.object({});

export const queryInputSchema = z.object({
  query: querySchema.optional(),
});

export const idInputSchema = z.object({
  id: z.string().min(1).describe('External COUNT UUID for the resource. Do not pass internal numeric IDs.'),
  query: querySchema.optional(),
});

export const bodyInputSchema = z.object({
  body: jsonBodySchema,
  query: querySchema.optional(),
});

export const optionalBodyInputSchema = z.object({
  body: jsonBodySchema.optional(),
  query: querySchema.optional(),
});

export const idBodyInputSchema = z.object({
  id: z.string().min(1).describe('External COUNT UUID for the resource. Do not pass internal numeric IDs.'),
  body: jsonBodySchema,
  query: querySchema.optional(),
});

export const idOptionalBodyInputSchema = z.object({
  id: z.string().min(1).describe('External COUNT UUID for the resource. Do not pass internal numeric IDs.'),
  body: jsonBodySchema.optional(),
  query: querySchema.optional(),
});

export const idVersionNumberInputSchema = z.object({
  id: z.string().min(1).describe('External COUNT budget UUID.'),
  versionNumber: z.union([z.string(), z.number()]).describe('Budget version number (integer, starting at 1).'),
  query: querySchema.optional(),
});

export const idVersionNumberBodyInputSchema = z.object({
  id: z.string().min(1).describe('External COUNT budget UUID.'),
  versionNumber: z.union([z.string(), z.number()]).describe('Budget version number (integer, starting at 1).'),
  body: jsonBodySchema,
  query: querySchema.optional(),
});

export const describeEndpointInputSchema = z.object({
  toolName: z
    .string()
    .min(1)
    .describe('Exact name of the COUNT_* tool you want guidance for, e.g. "COUNT_create_invoice".'),
});

export const knowledgeInputSchema = z.object({
  topic: z
    .string()
    .optional()
    .describe(
      'Optional FAQ topic id (e.g. authorize_additional_workspaces, reconnect_count_connector, report_category_filters). Omit to list all topics or use search.',
    ),
  search: z
    .string()
    .optional()
    .describe('Optional free-text search across FAQ titles and content (e.g. "shipping", "workspace", "bulk").'),
});

export const playbooksInputSchema = z.object({
  playbook: z
    .string()
    .optional()
    .describe(
      'Optional playbook id (e.g. pay_vendor_bill, migration_import, month_end_review). Omit to list all playbooks or use search.',
    ),
  search: z
    .string()
    .optional()
    .describe('Optional free-text search across playbook titles, summaries, and keywords.'),
});

export const resolveReferencesInputSchema = z.object({
  vendorName: z.string().optional().describe('Vendor display name to resolve to vendorUuid.'),
  customerName: z.string().optional().describe('Customer display name to resolve to customerUuid.'),
  customerEmail: z.string().optional().describe('Customer email to resolve to customerUuid.'),
  accountName: z.string().optional().describe('Chart-of-accounts name to resolve to account UUID.'),
  accountType: z
    .enum(['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses'])
    .optional()
    .describe('Optional account type filter when resolving accountName (case-sensitive, plural).'),
  projectName: z.string().optional().describe('Project name to resolve to projectUuid.'),
  tagName: z.string().optional().describe('Tag name to resolve to tagUuid.'),
});

export const validatePayloadInputSchema = z.object({
  toolName: z
    .string()
    .min(1)
    .describe('Exact COUNT_* mutation tool name to validate (e.g. COUNT_bulk_create_transactions).'),
  body: jsonBodySchema.optional().describe('Request body to validate — same shape as the target tool expects.'),
  query: querySchema.optional().describe('Query parameters to validate — same shape as the target tool expects.'),
  verifyReferences: z
    .boolean()
    .optional()
    .describe(
      'When true, loopback GET checks confirm UUID references exist in the workspace. Default false (structural validation only).',
    ),
});
