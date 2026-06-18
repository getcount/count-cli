import { getToolDefinition } from '../tools/definitions';
import { buildMcpRecoveryHint } from './mcpRecoveryHint.helper';
import type { McpReferenceResolutionPartnerClient } from './mcpReferenceResolution.helper';

/** Keep in sync with `MAX_PARTNER_BULK_BATCH_SIZE` in `src/app/helpers/partnerBulk.helper.ts`. */
const MAX_PARTNER_BULK_BATCH_SIZE = 100;

export interface McpPayloadValidationIssue {
  path: string;
  code: 'missing_required' | 'legacy_numeric_field' | 'invalid_tool' | 'bulk_envelope' | 'reference_not_found';
  message: string;
}

export interface ValidateMcpPayloadParams {
  toolName: string;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  verifyReferences?: boolean;
  client?: McpReferenceResolutionPartnerClient;
}

export interface ValidateMcpPayloadResult {
  valid: boolean;
  toolName: string;
  issueCount: number;
  issues: McpPayloadValidationIssue[];
  suggestedPlaybook?: string;
  _mcpRecoveryHint?: ReturnType<typeof buildMcpRecoveryHint>;
}

interface LegacyFieldRule {
  bodyField: string;
  uuidField: string;
  entityLabel: string;
}

interface LegacyQueryRule {
  queryField: string;
  uuidQueryField: string;
}

const QUERY_VALIDATION_READ_TOOLS = new Set(['COUNT_list_bills']);

const LOCAL_GUIDANCE_TOOLS = new Set([
  'COUNT_auth_status',
  'COUNT_describe_endpoint',
  'COUNT_knowledge',
  'COUNT_playbooks',
  'COUNT_resolve_references',
  'COUNT_validate_payload',
  'COUNT_refresh_access_token',
]);

const BULK_TOOL_BODY_FIELDS: Record<string, { bodyField: string; itemLabel: string; itemPluralLabel?: string }> = {
  COUNT_bulk_create_transactions: { bodyField: 'transactions', itemLabel: 'transaction' },
  COUNT_bulk_create_customers: { bodyField: 'customers', itemLabel: 'customer' },
  COUNT_bulk_update_customers: { bodyField: 'customers', itemLabel: 'customer' },
  COUNT_bulk_create_journal_entries: {
    bodyField: 'journalEntries',
    itemLabel: 'journal entry',
    itemPluralLabel: 'journal entries',
  },
};

const BILL_LEGACY_BODY_FIELDS: LegacyFieldRule[] = [
  { bodyField: 'vendorId', uuidField: 'vendorUuid', entityLabel: 'from list_vendors' },
  { bodyField: 'projectId', uuidField: 'projectUuid', entityLabel: 'from list_projects' },
  { bodyField: 'tags', uuidField: 'tagUuids', entityLabel: 'from list_tags' },
];

const BILL_LIST_LEGACY_QUERY_FIELDS: LegacyQueryRule[] = [
  { queryField: 'vendors', uuidQueryField: 'vendorUuids' },
  { queryField: 'projects', uuidQueryField: 'projectUuids' },
];

const UUID_FIELD_PATTERN =
  /^(.*)(Uuid|Uuids)$|^accUuid$|^id$|^uuid$|^categoryAccountUuid$|^categoryAccountUuids$|^accountUuid$/;

export function validateMcpPayload(params: ValidateMcpPayloadParams): ValidateMcpPayloadResult {
  const { toolName, body, query, verifyReferences = false, client } = params;
  const issues: McpPayloadValidationIssue[] = [];

  const toolDefinition = getToolDefinition({ toolName });
  if (!toolDefinition) {
    issues.push({
      path: 'toolName',
      code: 'invalid_tool',
      message: `Unknown tool "${toolName}". Use COUNT_describe_endpoint to list valid tool names.`,
    });
    return buildValidationResult({ toolName, issues });
  }

  if (LOCAL_GUIDANCE_TOOLS.has(toolName)) {
    issues.push({
      path: 'toolName',
      code: 'invalid_tool',
      message: `COUNT_validate_payload targets mutation tools only. "${toolName}" is read-only or a guidance tool.`,
    });
    return buildValidationResult({ toolName, issues });
  }

  if (toolDefinition.readOnly && !QUERY_VALIDATION_READ_TOOLS.has(toolName)) {
    issues.push({
      path: 'toolName',
      code: 'invalid_tool',
      message: `COUNT_validate_payload targets mutation tools only. "${toolName}" is read-only or a guidance tool.`,
    });
    return buildValidationResult({ toolName, issues });
  }

  validateBulkEnvelope({ toolName, body, issues });
  validateLegacyBillListQuery({ toolName, query, issues });
  validateLegacyBillBodyFields({ toolName, body, issues });
  validateRequiredFieldsForTool({ toolName, body, issues });

  void verifyReferences;
  void client;

  return buildValidationResult({ toolName, issues });
}

interface BuildValidationResultParams {
  toolName: string;
  issues: McpPayloadValidationIssue[];
}

function buildValidationResult(params: BuildValidationResultParams): ValidateMcpPayloadResult {
  const { toolName, issues } = params;
  const suggestedPlaybook = BULK_TOOL_BODY_FIELDS[toolName] ? 'migration_import' : undefined;
  const firstIssueMessage = issues[0]?.message;
  const recoveryHint = firstIssueMessage
    ? buildMcpRecoveryHint({ message: firstIssueMessage, toolName })
    : undefined;

  return {
    valid: issues.length === 0,
    toolName,
    issueCount: issues.length,
    issues,
    suggestedPlaybook,
    _mcpRecoveryHint: recoveryHint,
  };
}

interface ValidateBulkEnvelopeParams {
  toolName: string;
  body?: Record<string, unknown>;
  issues: McpPayloadValidationIssue[];
}

function validateBulkEnvelope(params: ValidateBulkEnvelopeParams): void {
  const { toolName, body, issues } = params;
  const bulkRule = BULK_TOOL_BODY_FIELDS[toolName];
  if (!bulkRule || !body) return;

  const items = body[bulkRule.bodyField];
  const itemPluralLabel = bulkRule.itemPluralLabel ?? `${bulkRule.itemLabel}s`;

  if (!Array.isArray(items)) {
    issues.push({
      path: `body.${bulkRule.bodyField}`,
      code: 'bulk_envelope',
      message: `\`${bulkRule.bodyField}\` must be a non-empty array of ${itemPluralLabel}.`,
    });
    return;
  }

  if (items.length === 0) {
    issues.push({
      path: `body.${bulkRule.bodyField}`,
      code: 'bulk_envelope',
      message: `\`${bulkRule.bodyField}\` must contain at least one ${bulkRule.itemLabel}.`,
    });
    return;
  }

  if (items.length > MAX_PARTNER_BULK_BATCH_SIZE) {
    issues.push({
      path: `body.${bulkRule.bodyField}`,
      code: 'bulk_envelope',
      message: `Bulk requests are capped at ${MAX_PARTNER_BULK_BATCH_SIZE} ${itemPluralLabel} per call (received ${items.length}). Split the import into multiple calls.`,
    });
  }
}

interface ValidateLegacyBillListQueryParams {
  toolName: string;
  query?: Record<string, unknown>;
  issues: McpPayloadValidationIssue[];
}

function validateLegacyBillListQuery(params: ValidateLegacyBillListQueryParams): void {
  const { toolName, query, issues } = params;
  if (toolName !== 'COUNT_list_bills' || !query) return;

  for (const legacyRule of BILL_LIST_LEGACY_QUERY_FIELDS) {
    const legacyValue = query[legacyRule.queryField];
    if (legacyValue === undefined || legacyValue === null || String(legacyValue).trim() === '') continue;
    issues.push({
      path: `query.${legacyRule.queryField}`,
      code: 'legacy_numeric_field',
      message: `Use \`${legacyRule.uuidQueryField}\`; numeric \`${legacyRule.queryField}\` is not accepted on partner bill list requests.`,
    });
  }
}

interface ValidateLegacyBillBodyFieldsParams {
  toolName: string;
  body?: Record<string, unknown>;
  issues: McpPayloadValidationIssue[];
}

function validateLegacyBillBodyFields(params: ValidateLegacyBillBodyFieldsParams): void {
  const { toolName, body, issues } = params;
  if (!body || (toolName !== 'COUNT_create_bill' && toolName !== 'COUNT_update_bill')) return;

  for (const legacyRule of BILL_LEGACY_BODY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(body, legacyRule.bodyField)) continue;
    if (Object.prototype.hasOwnProperty.call(body, legacyRule.uuidField)) continue;
    const legacyBodyValue = body[legacyRule.bodyField];
    if (
      legacyRule.bodyField === 'tags' &&
      Array.isArray(legacyBodyValue) &&
      legacyBodyValue.length === 0
    ) {
      continue;
    }
    issues.push({
      path: `body.${legacyRule.bodyField}`,
      code: 'legacy_numeric_field',
      message: `Use \`${legacyRule.uuidField}\` (${legacyRule.entityLabel}); numeric \`${legacyRule.bodyField}\` is not accepted on partner bill requests.`,
    });
  }
}

interface ValidateRequiredFieldsForToolParams {
  toolName: string;
  body?: Record<string, unknown>;
  issues: McpPayloadValidationIssue[];
}

function validateRequiredFieldsForTool(params: ValidateRequiredFieldsForToolParams): void {
  const { toolName, body, issues } = params;
  if (!body) return;

  if (toolName === 'COUNT_bulk_create_transactions') {
    validateBulkTransactionRows({ body, issues });
    return;
  }

  if (toolName === 'COUNT_bulk_create_customers') {
    validateBulkCustomerRows({ body, issues });
    return;
  }

  if (toolName === 'COUNT_bulk_update_customers') {
    validateBulkUpdateCustomerRows({ body, issues });
    return;
  }

  if (toolName === 'COUNT_bulk_create_journal_entries') {
    validateBulkJournalEntryRows({ body, issues });
    return;
  }

  if (toolName === 'COUNT_create_bill') {
    validateCreateBillBody({ body, issues });
  }
}

interface ValidateBulkTransactionRowsParams {
  body: Record<string, unknown>;
  issues: McpPayloadValidationIssue[];
}

function validateBulkTransactionRows(params: ValidateBulkTransactionRowsParams): void {
  const { body, issues } = params;
  const transactions = body.transactions;
  if (!Array.isArray(transactions)) return;

  transactions.forEach((_transaction, index) => {
    if (!_transaction || typeof _transaction !== 'object') {
      issues.push({
        path: `body.transactions[${index}]`,
        code: 'missing_required',
        message: 'Each transaction row must be an object.',
      });
      return;
    }
    const transactionObject = _transaction as Record<string, unknown>;
    if (!hasNonEmptyString(transactionObject.accUuid)) {
      issues.push({
        path: `body.transactions[${index}].accUuid`,
        code: 'missing_required',
        message: 'Required field accUuid (bank account UUID from list_accounts) is missing.',
      });
    }
    if (transactionObject.amount === undefined || transactionObject.amount === null) {
      issues.push({
        path: `body.transactions[${index}].amount`,
        code: 'missing_required',
        message: 'Required field amount is missing.',
      });
    }
    if (!hasNonEmptyString(transactionObject.postedDate) && !hasNonEmptyString(transactionObject.date)) {
      issues.push({
        path: `body.transactions[${index}].postedDate`,
        code: 'missing_required',
        message: 'Required field postedDate or date (YYYY-MM-DD) is missing.',
      });
    }
    if (Object.prototype.hasOwnProperty.call(transactionObject, 'vendorId') && !transactionObject.vendorUuid) {
      issues.push({
        path: `body.transactions[${index}].vendorId`,
        code: 'legacy_numeric_field',
        message: 'Use vendorUuid from list_vendors instead of numeric vendorId.',
      });
    }
  });
}

interface ValidateBulkCustomerRowsParams {
  body: Record<string, unknown>;
  issues: McpPayloadValidationIssue[];
}

function validateBulkCustomerRows(params: ValidateBulkCustomerRowsParams): void {
  const { body, issues } = params;
  const customers = body.customers;
  if (!Array.isArray(customers)) return;

  customers.forEach((_customer, index) => {
    if (!_customer || typeof _customer !== 'object') {
      issues.push({
        path: `body.customers[${index}]`,
        code: 'missing_required',
        message: 'Each customer row must be an object.',
      });
      return;
    }
    const customerObject = _customer as Record<string, unknown>;
    if (!hasNonEmptyString(customerObject.customer)) {
      issues.push({
        path: `body.customers[${index}].customer`,
        code: 'missing_required',
        message: 'Required field customer (display name) is missing.',
      });
    }
  });
}

interface ValidateBulkUpdateCustomerRowsParams {
  body: Record<string, unknown>;
  issues: McpPayloadValidationIssue[];
}

function validateBulkUpdateCustomerRows(params: ValidateBulkUpdateCustomerRowsParams): void {
  const { body, issues } = params;
  const customers = body.customers;
  if (!Array.isArray(customers)) return;

  customers.forEach((_customer, index) => {
    if (!_customer || typeof _customer !== 'object') {
      issues.push({
        path: `body.customers[${index}]`,
        code: 'missing_required',
        message: 'Each customer row must be an object.',
      });
      return;
    }
    const customerObject = _customer as Record<string, unknown>;
    if (!hasNonEmptyString(customerObject.uuid)) {
      issues.push({
        path: `body.customers[${index}].uuid`,
        code: 'missing_required',
        message: 'Each customer update row requires uuid (external customer id from list_customers).',
      });
    }
  });
}

interface ValidateBulkJournalEntryRowsParams {
  body: Record<string, unknown>;
  issues: McpPayloadValidationIssue[];
}

function validateBulkJournalEntryRows(params: ValidateBulkJournalEntryRowsParams): void {
  const { body, issues } = params;
  const journalEntries = body.journalEntries;
  if (!Array.isArray(journalEntries)) return;

  journalEntries.forEach((_journalEntry, index) => {
    if (!_journalEntry || typeof _journalEntry !== 'object') {
      issues.push({
        path: `body.journalEntries[${index}]`,
        code: 'missing_required',
        message: 'Each journal entry row must be an object.',
      });
      return;
    }
    const journalEntryObject = _journalEntry as Record<string, unknown>;
    if (!hasNonEmptyString(journalEntryObject.descriptionEntry)) {
      issues.push({
        path: `body.journalEntries[${index}].descriptionEntry`,
        code: 'missing_required',
        message: 'Required field descriptionEntry is missing.',
      });
    }
    if (!hasNonEmptyString(journalEntryObject.date)) {
      issues.push({
        path: `body.journalEntries[${index}].date`,
        code: 'missing_required',
        message: 'Required field date (YYYY-MM-DD) is missing.',
      });
    }
    if (!Array.isArray(journalEntryObject.lines) || journalEntryObject.lines.length === 0) {
      issues.push({
        path: `body.journalEntries[${index}].lines`,
        code: 'missing_required',
        message: 'Required field lines must be a non-empty array.',
      });
      return;
    }
    journalEntryObject.lines.forEach((_line, lineIndex) => {
      if (!_line || typeof _line !== 'object') {
        issues.push({
          path: `body.journalEntries[${index}].lines[${lineIndex}]`,
          code: 'missing_required',
          message: 'Each journal line must be an object.',
        });
        return;
      }
      const lineObject = _line as Record<string, unknown>;
      if (!hasNonEmptyString(lineObject.accountUuid)) {
        issues.push({
          path: `body.journalEntries[${index}].lines[${lineIndex}].accountUuid`,
          code: 'missing_required',
          message: 'Each line requires accountUuid from list_accounts.',
        });
      }
    });
  });
}

interface ValidateCreateBillBodyParams {
  body: Record<string, unknown>;
  issues: McpPayloadValidationIssue[];
}

function validateCreateBillBody(params: ValidateCreateBillBodyParams): void {
  const { body, issues } = params;

  if (!hasNonEmptyString(body.vendorUuid)) {
    issues.push({
      path: 'body.vendorUuid',
      code: 'missing_required',
      message: 'Required field vendorUuid (from list_vendors) is missing.',
    });
  }
  if (!hasNonEmptyString(body.date)) {
    issues.push({
      path: 'body.date',
      code: 'missing_required',
      message: 'Required field date (YYYY-MM-DD) is missing.',
    });
  }
  if (!hasNonEmptyString(body.dueDate)) {
    issues.push({
      path: 'body.dueDate',
      code: 'missing_required',
      message: 'Required field dueDate (YYYY-MM-DD) is missing.',
    });
  }
  if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
    issues.push({
      path: 'body.lineItems',
      code: 'missing_required',
      message: 'Required field lineItems must be a non-empty array.',
    });
    return;
  }

  body.lineItems.forEach((_lineItem, index) => {
    if (!_lineItem || typeof _lineItem !== 'object') {
      issues.push({
        path: `body.lineItems[${index}]`,
        code: 'missing_required',
        message: 'Each line item must be an object.',
      });
      return;
    }
    const lineItemObject = _lineItem as Record<string, unknown>;
    if (!hasNonEmptyString(lineItemObject.categoryAccountUuid)) {
      issues.push({
        path: `body.lineItems[${index}].categoryAccountUuid`,
        code: 'missing_required',
        message: 'Each line item requires categoryAccountUuid from list_accounts.',
      });
    }
    if (Object.prototype.hasOwnProperty.call(lineItemObject, 'categoryAccountId')) {
      issues.push({
        path: `body.lineItems[${index}].categoryAccountId`,
        code: 'legacy_numeric_field',
        message: 'Use categoryAccountUuid from list_accounts instead of categoryAccountId.',
      });
    }
    if (!hasRequiredNumericField(lineItemObject.quantity)) {
      issues.push({
        path: `body.lineItems[${index}].quantity`,
        code: 'missing_required',
        message: 'Each line item requires quantity.',
      });
    }
    if (!hasRequiredNumericField(lineItemObject.price)) {
      issues.push({
        path: `body.lineItems[${index}].price`,
        code: 'missing_required',
        message: 'Each line item requires price.',
      });
    }
  });
}

function hasRequiredNumericField(value: unknown): boolean {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return true;
  }
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return true;
  }
  return false;
}

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

interface CollectUuidReferencesParams {
  value: unknown;
  currentPath: string;
  references: Array<{ path: string; uuid: string }>;
}

/** Walk a payload tree and collect string values on UUID-shaped field names for optional existence checks. */
export function collectUuidReferencesFromPayload(params: {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}): Array<{ path: string; uuid: string }> {
  const references: Array<{ path: string; uuid: string }> = [];
  if (params.body) {
    walkValueForUuidReferences({ value: params.body, currentPath: 'body', references });
  }
  if (params.query) {
    walkValueForUuidReferences({ value: params.query, currentPath: 'query', references });
  }
  return references;
}

function walkValueForUuidReferences(params: CollectUuidReferencesParams): void {
  const { value, currentPath, references } = params;

  if (Array.isArray(value)) {
    value.forEach((_item, index) => {
      walkValueForUuidReferences({ value: _item, currentPath: `${currentPath}[${index}]`, references });
    });
    return;
  }

  if (!value || typeof value !== 'object') return;

  const valueObject = value as Record<string, unknown>;
  for (const [fieldName, fieldValue] of Object.entries(valueObject)) {
    const fieldPath = `${currentPath}.${fieldName}`;
    if (typeof fieldValue === 'string' && fieldValue.trim() !== '' && UUID_FIELD_PATTERN.test(fieldName)) {
      if (fieldName.endsWith('Uuids') && fieldValue.includes(',')) {
        fieldValue.split(',').forEach((_uuidSegment, index) => {
          const trimmedUuidSegment = _uuidSegment.trim();
          if (trimmedUuidSegment !== '') {
            references.push({ path: `${fieldPath}[${index}]`, uuid: trimmedUuidSegment });
          }
        });
      } else {
        references.push({ path: fieldPath, uuid: fieldValue.trim() });
      }
    } else if (Array.isArray(fieldValue) && fieldName.endsWith('Uuids')) {
      fieldValue.forEach((_uuidValue, index) => {
        if (typeof _uuidValue === 'string' && _uuidValue.trim() !== '') {
          references.push({ path: `${fieldPath}[${index}]`, uuid: _uuidValue.trim() });
        }
      });
    } else {
      walkValueForUuidReferences({ value: fieldValue, currentPath: fieldPath, references });
    }
  }
}

interface VerifyUuidReferencesExistParams {
  client: McpReferenceResolutionPartnerClient;
  references: Array<{ path: string; uuid: string }>;
}

type UuidReferenceVerificationKind = 'customer' | 'project' | 'tag' | 'vendor' | 'account';

interface ClassifyUuidReferenceFieldPathParams {
  fieldPath: string;
}

function canonicalizeUuidForPartnerLookup(uuid: string): string {
  return uuid.trim().toLowerCase();
}

function classifyUuidReferenceFieldPath(params: ClassifyUuidReferenceFieldPathParams): UuidReferenceVerificationKind | null {
  const { fieldPath } = params;
  if (fieldPath.includes('customerUuid')) {
    return 'customer';
  }
  if (fieldPath.includes('projectUuid')) {
    return 'project';
  }
  if (fieldPath.includes('tagUuid')) {
    return 'tag';
  }
  if (fieldPath.includes('vendorUuid')) {
    return 'vendor';
  }
  if (
    fieldPath.includes('accUuid') ||
    fieldPath.includes('categoryAccountUuid') ||
    fieldPath.includes('accountUuid')
  ) {
    return 'account';
  }
  return null;
}

interface ExtractPartnerListRecordsParams {
  response: unknown;
  recordsKey: string;
}

function extractPartnerListRecords(params: ExtractPartnerListRecordsParams): unknown[] {
  const { response, recordsKey } = params;
  if (!response || typeof response !== 'object') {
    return [];
  }

  const responseObject = response as Record<string, unknown>;
  const directArray = responseObject[recordsKey];
  if (Array.isArray(directArray)) {
    return directArray;
  }

  const dataObject = responseObject.data;
  if (dataObject && typeof dataObject === 'object') {
    const nestedArray = (dataObject as Record<string, unknown>)[recordsKey];
    if (Array.isArray(nestedArray)) {
      return nestedArray;
    }
  }

  return [];
}

interface LoadPartnerRecordUuidSetParams {
  client: McpReferenceResolutionPartnerClient;
  path: string;
  recordsKey: string;
  uuidFieldNames: string[];
}

const PARTNER_REFERENCE_LIST_PAGE_LIMIT = 5000;
const PARTNER_REFERENCE_LIST_MAX_PAGES = 200;

interface ExtractPartnerListTotalRecordsParams {
  response: unknown;
}

function extractPartnerListTotalRecords(params: ExtractPartnerListTotalRecordsParams): number | undefined {
  const { response } = params;
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const responseObject = response as Record<string, unknown>;
  if (typeof responseObject.totalRecords === 'number' && Number.isFinite(responseObject.totalRecords)) {
    return responseObject.totalRecords;
  }

  const dataObject = responseObject.data;
  if (dataObject && typeof dataObject === 'object') {
    const nestedTotalRecords = (dataObject as Record<string, unknown>).totalRecords;
    if (typeof nestedTotalRecords === 'number' && Number.isFinite(nestedTotalRecords)) {
      return nestedTotalRecords;
    }
  }

  return undefined;
}

async function loadPartnerRecordUuidSet(params: LoadPartnerRecordUuidSetParams): Promise<Set<string>> {
  const { client, path, recordsKey, uuidFieldNames } = params;
  const uuidSet = new Set<string>();
  let page = 1;
  let totalRecords: number | undefined;
  let fetchedRecordCount = 0;

  while (page <= PARTNER_REFERENCE_LIST_MAX_PAGES) {
    const response = await client.request({
      method: 'GET',
      path,
      query: { page, limit: PARTNER_REFERENCE_LIST_PAGE_LIMIT },
      requiresUserAuth: true,
    });

    if (totalRecords === undefined) {
      totalRecords = extractPartnerListTotalRecords({ response });
    }

    const pageRecords = extractPartnerListRecords({ response, recordsKey });
    for (const rawRecord of pageRecords) {
      if (!rawRecord || typeof rawRecord !== 'object') {
        continue;
      }
      const recordObject = rawRecord as Record<string, unknown>;
      for (const uuidFieldName of uuidFieldNames) {
        const fieldValue = recordObject[uuidFieldName];
        if (typeof fieldValue === 'string' && fieldValue.trim() !== '') {
          uuidSet.add(canonicalizeUuidForPartnerLookup(fieldValue));
        }
      }
    }

    fetchedRecordCount += pageRecords.length;
    if (pageRecords.length === 0) {
      break;
    }
    if (pageRecords.length < PARTNER_REFERENCE_LIST_PAGE_LIMIT) {
      break;
    }
    if (totalRecords !== undefined && fetchedRecordCount >= totalRecords) {
      break;
    }

    page += 1;
  }

  return uuidSet;
}

interface ProbePartnerResourceByUuidParams {
  client: McpReferenceResolutionPartnerClient;
  pathTemplate: string;
  uuid: string;
}

async function probePartnerResourceByUuid(params: ProbePartnerResourceByUuidParams): Promise<boolean> {
  const { client, pathTemplate, uuid } = params;
  const canonicalUuid = canonicalizeUuidForPartnerLookup(uuid);
  try {
    await client.request({
      method: 'GET',
      path: pathTemplate.replace('{uuid}', encodeURIComponent(canonicalUuid)),
      requiresUserAuth: true,
    });
    return true;
  } catch {
    return false;
  }
}

/** Path-aware UUID existence checks using partner routes that actually exist. */
export async function verifyUuidReferencesExist(
  params: VerifyUuidReferencesExistParams
): Promise<McpPayloadValidationIssue[]> {
  const { client, references } = params;
  const issues: McpPayloadValidationIssue[] = [];
  const seenReferenceKeys = new Set<string>();

  const needsVendorList = references.some(
    (_reference) => classifyUuidReferenceFieldPath({ fieldPath: _reference.path }) === 'vendor'
  );
  const needsAccountList = references.some(
    (_reference) => classifyUuidReferenceFieldPath({ fieldPath: _reference.path }) === 'account'
  );

  const [vendorUuidSet, accountUuidSet] = await Promise.all([
    needsVendorList
      ? loadPartnerRecordUuidSet({
          client,
          path: '/partners/vendors',
          recordsKey: 'vendors',
          uuidFieldNames: ['id', 'uuid'],
        })
      : Promise.resolve(new Set<string>()),
    needsAccountList
      ? loadPartnerRecordUuidSet({
          client,
          path: '/partners/chart-of-accounts',
          recordsKey: 'accounts',
          uuidFieldNames: ['id', 'uuid', 'accUuid', 'accountUuid'],
        })
      : Promise.resolve(new Set<string>()),
  ]);

  for (const reference of references) {
    const referenceKey = `${reference.path}:${reference.uuid}`;
    if (seenReferenceKeys.has(referenceKey)) {
      continue;
    }
    seenReferenceKeys.add(referenceKey);

    const verificationKind = classifyUuidReferenceFieldPath({ fieldPath: reference.path });
    if (!verificationKind) {
      continue;
    }

    const canonicalUuid = canonicalizeUuidForPartnerLookup(reference.uuid);
    let exists = false;

    if (verificationKind === 'customer') {
      exists = await probePartnerResourceByUuid({
        client,
        pathTemplate: '/partners/customers/{uuid}',
        uuid: reference.uuid,
      });
    } else if (verificationKind === 'project') {
      exists = await probePartnerResourceByUuid({
        client,
        pathTemplate: '/partners/projects/{uuid}',
        uuid: reference.uuid,
      });
    } else if (verificationKind === 'tag') {
      exists = await probePartnerResourceByUuid({
        client,
        pathTemplate: '/partners/tags/{uuid}',
        uuid: reference.uuid,
      });
    } else if (verificationKind === 'vendor') {
      exists = vendorUuidSet.has(canonicalUuid);
    } else if (verificationKind === 'account') {
      exists = accountUuidSet.has(canonicalUuid);
    }

    if (!exists) {
      issues.push({
        path: reference.path,
        code: 'reference_not_found',
        message: `UUID "${reference.uuid}" was not found in this workspace. Use COUNT_resolve_references or the matching list/get tool.`,
      });
    }
  }

  return issues;
}

export async function validateMcpPayloadAsync(params: ValidateMcpPayloadParams): Promise<ValidateMcpPayloadResult> {
  const baseResult = validateMcpPayload(params);
  if (!params.verifyReferences || !params.client || baseResult.issues.length > 0) {
    return baseResult;
  }

  const uuidReferences = collectUuidReferencesFromPayload({ body: params.body, query: params.query });
  const referenceIssues = await verifyUuidReferencesExist({ client: params.client, references: uuidReferences });
  const combinedIssues = [...baseResult.issues, ...referenceIssues];

  return buildValidationResult({ toolName: params.toolName, issues: combinedIssues });
}
