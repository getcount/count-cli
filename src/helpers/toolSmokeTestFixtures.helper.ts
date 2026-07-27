import { executeCountPartnerTool } from '../partner-mcp/tools/registerTools.js';
import { getToolDefinition, toolDefinitions } from '../partner-mcp/tools/definitions.js';
import type { PartnerApiClient } from '../partner-mcp/partnerApiClient.js';
import type { ToolDefinition } from '../partner-mcp/types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface SmokeTestFixtureIdentifierCache {
  fixtureIdentifiersByResourcePath: Record<string, string>;
  supportingAccountIdentifiers: {
    expenseCategoryAccountIdentifier?: string;
    bankAccountIdentifier?: string;
  };
}

interface SleepParams {
  milliseconds: number;
}

interface SeedSmokeTestFixturesParams {
  client: PartnerApiClient;
  fixtureIdentifierCache: SmokeTestFixtureIdentifierCache;
  delayBetweenCallsMilliseconds: number;
}

interface ExecuteListToolForFixtureSeedingParams {
  listTool: ToolDefinition;
  client: PartnerApiClient;
  fixtureIdentifierCache: SmokeTestFixtureIdentifierCache;
}

interface CreateSmokeTestRecordParams {
  createToolName: string;
  createToolInput: Record<string, unknown>;
  client: PartnerApiClient;
  fixtureResourcePath: string;
  fixtureIdentifierCache: SmokeTestFixtureIdentifierCache;
}

interface EnsureSmokeTestRecordExistsParams {
  fixtureResourcePath: string;
  listToolName: string;
  createToolName: string;
  buildCreateToolInput: (params: {
    fixtureIdentifierCache: SmokeTestFixtureIdentifierCache;
  }) => Record<string, unknown> | null;
  client: PartnerApiClient;
  fixtureIdentifierCache: SmokeTestFixtureIdentifierCache;
  delayBetweenCallsMilliseconds: number;
}

interface PopulateSupportingAccountIdentifiersParams {
  client: PartnerApiClient;
  fixtureIdentifierCache: SmokeTestFixtureIdentifierCache;
  delayBetweenCallsMilliseconds: number;
}

const SMOKE_TEST_RECORD_LABEL = 'CLI Smoke Test Fixture';

function sleep(params: SleepParams): Promise<void> {
  return new Promise((_resolve) => {
    setTimeout(_resolve, params.milliseconds);
  });
}

function listPathToFixtureResourcePath(pathTemplate: string): string {
  return pathTemplate.replace(/^\/partners\//, '');
}

function buildSmokeTestIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function extractIdentifierFromRecordObject(recordObject: Record<string, unknown>): string | undefined {
  if (typeof recordObject.id === 'string' && recordObject.id.trim() !== '') {
    return recordObject.id;
  }

  if (typeof recordObject.uuid === 'string' && recordObject.uuid.trim() !== '') {
    return recordObject.uuid;
  }

  if (typeof recordObject.accUuid === 'string' && recordObject.accUuid.trim() !== '') {
    return recordObject.accUuid;
  }

  return undefined;
}

function extractIdentifierFromFirstRecordInArray(recordArray: unknown[]): string | undefined {
  for (const recordEntry of recordArray) {
    if (!recordEntry || typeof recordEntry !== 'object' || Array.isArray(recordEntry)) {
      continue;
    }

    const recordIdentifier = extractIdentifierFromRecordObject(recordEntry as Record<string, unknown>);
    if (recordIdentifier) {
      return recordIdentifier;
    }
  }

  return undefined;
}

function extractIdentifierFromKnownResponseCollections(responseObject: Record<string, unknown>): string | undefined {
  const knownCollectionKeys = [
    'records',
    'customers',
    'vendors',
    'bills',
    'invoices',
    'products',
    'tags',
    'projects',
    'tasks',
    'transactions',
    'journalEntries',
    'people',
    'timeEntries',
    'expenseReceipts',
    'budgets',
    'recurringInvoiceTemplates',
  ];

  for (const collectionKey of knownCollectionKeys) {
    const collectionValue = responseObject[collectionKey];
    if (Array.isArray(collectionValue)) {
      const recordIdentifier = extractIdentifierFromFirstRecordInArray(collectionValue);
      if (recordIdentifier) {
        return recordIdentifier;
      }
    }
  }

  const nestedMessage =
    responseObject.message && typeof responseObject.message === 'object' && !Array.isArray(responseObject.message)
      ? (responseObject.message as Record<string, unknown>)
      : undefined;

  if (nestedMessage && Array.isArray(nestedMessage.products)) {
    return extractIdentifierFromFirstRecordInArray(nestedMessage.products);
  }

  return undefined;
}

export function extractRecordIdentifierFromApiResponse(apiResponse: unknown): string | undefined {
  if (Array.isArray(apiResponse)) {
    return extractIdentifierFromFirstRecordInArray(apiResponse);
  }

  if (!apiResponse || typeof apiResponse !== 'object') {
    return undefined;
  }

  const responseObject = apiResponse as Record<string, unknown>;

  const directRecordIdentifier = extractIdentifierFromRecordObject(responseObject);
  if (directRecordIdentifier) {
    return directRecordIdentifier;
  }

  const knownCollectionIdentifier = extractIdentifierFromKnownResponseCollections(responseObject);
  if (knownCollectionIdentifier) {
    return knownCollectionIdentifier;
  }

  const nestedData =
    responseObject.data && typeof responseObject.data === 'object' && !Array.isArray(responseObject.data)
      ? (responseObject.data as Record<string, unknown>)
      : undefined;

  if (nestedData) {
    const nestedDirectRecordIdentifier = extractIdentifierFromRecordObject(nestedData);
    if (nestedDirectRecordIdentifier) {
      return nestedDirectRecordIdentifier;
    }

    const nestedCollectionIdentifier = extractIdentifierFromKnownResponseCollections(nestedData);
    if (nestedCollectionIdentifier) {
      return nestedCollectionIdentifier;
    }

    const nestedArrayScanIdentifier = extractIdentifierFromAnyArrayInObject(nestedData);
    if (nestedArrayScanIdentifier) {
      return nestedArrayScanIdentifier;
    }
  }

  return extractIdentifierFromAnyArrayInObject(responseObject);
}

function extractIdentifierFromAnyArrayInObject(responseObject: Record<string, unknown>): string | undefined {
  for (const objectValue of Object.values(responseObject)) {
    if (!Array.isArray(objectValue)) {
      continue;
    }

    const recordIdentifier = extractIdentifierFromFirstRecordInArray(objectValue);
    if (recordIdentifier) {
      return recordIdentifier;
    }
  }

  return undefined;
}

function updateFixtureCacheFromListToolResponse(params: {
  listTool: ToolDefinition;
  toolResult: CallToolResult;
  fixtureIdentifierCache: SmokeTestFixtureIdentifierCache;
}): void {
  if (params.toolResult.isError || params.listTool.pathTemplate.includes('{')) {
    return;
  }

  const recordIdentifier = extractRecordIdentifierFromApiResponse(params.toolResult.structuredContent?.result);
  if (!recordIdentifier) {
    return;
  }

  const fixtureResourcePath = listPathToFixtureResourcePath(params.listTool.pathTemplate);
  params.fixtureIdentifierCache.fixtureIdentifiersByResourcePath[fixtureResourcePath] = recordIdentifier;
}

function isListToolEligibleForFixtureSeeding(tool: ToolDefinition): boolean {
  if (!tool.readOnly || tool.method !== 'GET' || tool.pathTemplate.startsWith('/__local')) {
    return false;
  }

  if (tool.pathTemplate.startsWith('/partners/reports/')) {
    return false;
  }

  if (tool.pathTemplate.endsWith('/overall') || tool.name === 'COUNT_get_workspace_stats') {
    return false;
  }

  return tool.name.startsWith('COUNT_list_');
}

async function executeListToolForFixtureSeeding(
  params: ExecuteListToolForFixtureSeedingParams,
): Promise<void> {
  const listToolInput =
    params.listTool.name === 'COUNT_list_project_tasks'
      ? params.fixtureIdentifierCache.fixtureIdentifiersByResourcePath.projects
        ? {
            id: params.fixtureIdentifierCache.fixtureIdentifiersByResourcePath.projects,
            query: { limit: 1 },
          }
        : null
      : { query: { limit: 1 } };

  if (listToolInput === null) {
    return;
  }

  const toolResult = await executeCountPartnerTool({
    tool: params.listTool,
    input: listToolInput,
    client: params.client,
  });

  updateFixtureCacheFromListToolResponse({
    listTool: params.listTool,
    toolResult,
    fixtureIdentifierCache: params.fixtureIdentifierCache,
  });
}

async function createSmokeTestRecord(params: CreateSmokeTestRecordParams): Promise<boolean> {
  const createTool = getToolDefinition({ toolName: params.createToolName });
  if (!createTool) {
    return false;
  }

  const toolResult = await executeCountPartnerTool({
    tool: createTool,
    input: params.createToolInput,
    client: params.client,
  });

  if (toolResult.isError) {
    return false;
  }

  const recordIdentifier = extractRecordIdentifierFromApiResponse(toolResult.structuredContent?.result);
  if (!recordIdentifier) {
    return false;
  }

  params.fixtureIdentifierCache.fixtureIdentifiersByResourcePath[params.fixtureResourcePath] = recordIdentifier;
  return true;
}

async function populateSupportingAccountIdentifiers(
  params: PopulateSupportingAccountIdentifiersParams,
): Promise<void> {
  const listAccountsTool = getToolDefinition({ toolName: 'COUNT_list_accounts' });
  if (!listAccountsTool) {
    return;
  }

  const expenseAccountsResult = await executeCountPartnerTool({
    tool: listAccountsTool,
    input: { query: { type: 'Expenses', limit: 1 } },
    client: params.client,
  });

  if (!expenseAccountsResult.isError) {
    const expenseAccountIdentifier = extractRecordIdentifierFromApiResponse(
      expenseAccountsResult.structuredContent?.result,
    );
    if (expenseAccountIdentifier) {
      params.fixtureIdentifierCache.supportingAccountIdentifiers.expenseCategoryAccountIdentifier =
        expenseAccountIdentifier;
      params.fixtureIdentifierCache.fixtureIdentifiersByResourcePath['chart-of-accounts'] =
        expenseAccountIdentifier;
    }
  }

  await sleep({ milliseconds: params.delayBetweenCallsMilliseconds });

  const bankAccountsResult = await executeCountPartnerTool({
    tool: listAccountsTool,
    input: { query: { type: 'Assets', limit: 1 } },
    client: params.client,
  });

  if (!bankAccountsResult.isError) {
    const bankAccountIdentifier = extractRecordIdentifierFromApiResponse(
      bankAccountsResult.structuredContent?.result,
    );
    if (bankAccountIdentifier) {
      params.fixtureIdentifierCache.supportingAccountIdentifiers.bankAccountIdentifier = bankAccountIdentifier;
    }
  }
}

async function ensureSmokeTestRecordExists(params: EnsureSmokeTestRecordExistsParams): Promise<void> {
  if (params.fixtureIdentifierCache.fixtureIdentifiersByResourcePath[params.fixtureResourcePath]) {
    return;
  }

  const listTool = getToolDefinition({ toolName: params.listToolName });
  if (listTool) {
    await executeListToolForFixtureSeeding({
      listTool,
      client: params.client,
      fixtureIdentifierCache: params.fixtureIdentifierCache,
    });
    await sleep({ milliseconds: params.delayBetweenCallsMilliseconds });
  }

  if (params.fixtureIdentifierCache.fixtureIdentifiersByResourcePath[params.fixtureResourcePath]) {
    return;
  }

  const createToolInput = params.buildCreateToolInput({ fixtureIdentifierCache: params.fixtureIdentifierCache });
  if (!createToolInput) {
    return;
  }

  await createSmokeTestRecord({
    createToolName: params.createToolName,
    createToolInput,
    client: params.client,
    fixtureResourcePath: params.fixtureResourcePath,
    fixtureIdentifierCache: params.fixtureIdentifierCache,
  });
  await sleep({ milliseconds: params.delayBetweenCallsMilliseconds });
}

export async function seedSmokeTestFixtures(params: SeedSmokeTestFixturesParams): Promise<void> {
  const listToolsForFixtureSeeding = toolDefinitions
    .filter(isListToolEligibleForFixtureSeeding)
    .sort((_leftTool, _rightTool) => {
      const leftHasPathParameter = _leftTool.pathTemplate.includes('{') ? 1 : 0;
      const rightHasPathParameter = _rightTool.pathTemplate.includes('{') ? 1 : 0;
      if (leftHasPathParameter !== rightHasPathParameter) {
        return leftHasPathParameter - rightHasPathParameter;
      }

      return _leftTool.name.localeCompare(_rightTool.name);
    });

  for (const listTool of listToolsForFixtureSeeding) {
    await executeListToolForFixtureSeeding({
      listTool,
      client: params.client,
      fixtureIdentifierCache: params.fixtureIdentifierCache,
    });
    await sleep({ milliseconds: params.delayBetweenCallsMilliseconds });
  }

  await populateSupportingAccountIdentifiers({
    client: params.client,
    fixtureIdentifierCache: params.fixtureIdentifierCache,
    delayBetweenCallsMilliseconds: params.delayBetweenCallsMilliseconds,
  });

  const smokeTestIsoDate = buildSmokeTestIsoDate();

  await ensureSmokeTestRecordExists({
    fixtureResourcePath: 'customers',
    listToolName: 'COUNT_list_customers',
    createToolName: 'COUNT_create_customer',
    buildCreateToolInput: () => ({
      body: {
        customer: `${SMOKE_TEST_RECORD_LABEL} Customer`,
        email: 'cli-smoke-test-fixture@example.com',
      },
    }),
    client: params.client,
    fixtureIdentifierCache: params.fixtureIdentifierCache,
    delayBetweenCallsMilliseconds: params.delayBetweenCallsMilliseconds,
  });

  await ensureSmokeTestRecordExists({
    fixtureResourcePath: 'vendors',
    listToolName: 'COUNT_list_vendors',
    createToolName: 'COUNT_create_vendor',
    buildCreateToolInput: () => ({
      body: {
        vendor: `${SMOKE_TEST_RECORD_LABEL} Vendor`,
      },
    }),
    client: params.client,
    fixtureIdentifierCache: params.fixtureIdentifierCache,
    delayBetweenCallsMilliseconds: params.delayBetweenCallsMilliseconds,
  });

  await ensureSmokeTestRecordExists({
    fixtureResourcePath: 'products',
    listToolName: 'COUNT_list_products',
    createToolName: 'COUNT_create_product',
    buildCreateToolInput: () => ({
      body: {
        name: `${SMOKE_TEST_RECORD_LABEL} Product`,
      },
    }),
    client: params.client,
    fixtureIdentifierCache: params.fixtureIdentifierCache,
    delayBetweenCallsMilliseconds: params.delayBetweenCallsMilliseconds,
  });

  await ensureSmokeTestRecordExists({
    fixtureResourcePath: 'tags',
    listToolName: 'COUNT_list_tags',
    createToolName: 'COUNT_create_tag',
    buildCreateToolInput: () => ({
      body: {
        name: `${SMOKE_TEST_RECORD_LABEL} Tag`,
      },
    }),
    client: params.client,
    fixtureIdentifierCache: params.fixtureIdentifierCache,
    delayBetweenCallsMilliseconds: params.delayBetweenCallsMilliseconds,
  });

  await ensureSmokeTestRecordExists({
    fixtureResourcePath: 'tags/groups',
    listToolName: 'COUNT_list_tag_groups',
    createToolName: 'COUNT_create_tag_group',
    buildCreateToolInput: () => ({
      body: {
        name: `${SMOKE_TEST_RECORD_LABEL} Tag Group`,
      },
    }),
    client: params.client,
    fixtureIdentifierCache: params.fixtureIdentifierCache,
    delayBetweenCallsMilliseconds: params.delayBetweenCallsMilliseconds,
  });

  await ensureSmokeTestRecordExists({
    fixtureResourcePath: 'projects',
    listToolName: 'COUNT_list_projects',
    createToolName: 'COUNT_create_project',
    buildCreateToolInput: (buildParams) => ({
      body: {
        name: `${SMOKE_TEST_RECORD_LABEL} Project`,
        customerUuid: buildParams.fixtureIdentifierCache.fixtureIdentifiersByResourcePath.customers ?? null,
      },
    }),
    client: params.client,
    fixtureIdentifierCache: params.fixtureIdentifierCache,
    delayBetweenCallsMilliseconds: params.delayBetweenCallsMilliseconds,
  });

  await ensureSmokeTestRecordExists({
    fixtureResourcePath: 'tasks',
    listToolName: 'COUNT_list_tasks',
    createToolName: 'COUNT_create_task',
    buildCreateToolInput: () => ({
      body: {
        type: 'general',
        name: `${SMOKE_TEST_RECORD_LABEL} Task`,
      },
    }),
    client: params.client,
    fixtureIdentifierCache: params.fixtureIdentifierCache,
    delayBetweenCallsMilliseconds: params.delayBetweenCallsMilliseconds,
  });

  await ensureSmokeTestRecordExists({
    fixtureResourcePath: 'bills',
    listToolName: 'COUNT_list_bills',
    createToolName: 'COUNT_create_bill',
    buildCreateToolInput: (buildParams) => {
      const vendorIdentifier = buildParams.fixtureIdentifierCache.fixtureIdentifiersByResourcePath.vendors;
      const expenseCategoryAccountIdentifier =
        buildParams.fixtureIdentifierCache.supportingAccountIdentifiers.expenseCategoryAccountIdentifier;

      if (!vendorIdentifier || !expenseCategoryAccountIdentifier) {
        return null;
      }

      return {
        body: {
          vendorUuid: vendorIdentifier,
          date: smokeTestIsoDate,
          dueDate: smokeTestIsoDate,
          lineItems: [
            {
              categoryAccountUuid: expenseCategoryAccountIdentifier,
              description: `${SMOKE_TEST_RECORD_LABEL} Bill Line`,
              quantity: 1,
              price: 1,
            },
          ],
        },
      };
    },
    client: params.client,
    fixtureIdentifierCache: params.fixtureIdentifierCache,
    delayBetweenCallsMilliseconds: params.delayBetweenCallsMilliseconds,
  });

  await ensureSmokeTestRecordExists({
    fixtureResourcePath: 'invoices',
    listToolName: 'COUNT_list_invoices',
    createToolName: 'COUNT_create_invoice',
    buildCreateToolInput: (buildParams) => {
      const customerIdentifier = buildParams.fixtureIdentifierCache.fixtureIdentifiersByResourcePath.customers;
      const productIdentifier = buildParams.fixtureIdentifierCache.fixtureIdentifiersByResourcePath.products;

      if (!customerIdentifier || !productIdentifier) {
        return null;
      }

      return {
        body: {
          customerUuid: customerIdentifier,
          date: smokeTestIsoDate,
          dueDate: smokeTestIsoDate,
          isDraft: true,
          products: [
            {
              productUuid: productIdentifier,
              quantity: 1,
              unitPrice: 1,
            },
          ],
        },
      };
    },
    client: params.client,
    fixtureIdentifierCache: params.fixtureIdentifierCache,
    delayBetweenCallsMilliseconds: params.delayBetweenCallsMilliseconds,
  });

  await ensureSmokeTestRecordExists({
    fixtureResourcePath: 'recurring-invoice-templates',
    listToolName: 'COUNT_list_recurring_invoice_templates',
    createToolName: 'COUNT_create_recurring_invoice_template',
    buildCreateToolInput: (buildParams) => {
      const customerIdentifier = buildParams.fixtureIdentifierCache.fixtureIdentifiersByResourcePath.customers;
      const productIdentifier = buildParams.fixtureIdentifierCache.fixtureIdentifiersByResourcePath.products;

      if (!customerIdentifier || !productIdentifier) {
        return null;
      }

      return {
        body: {
          customerUuid: customerIdentifier,
          date: smokeTestIsoDate,
          recurrencePattern: 'monthly',
          products: [
            {
              productUuid: productIdentifier,
              quantity: 1,
              unitPrice: 1,
            },
          ],
        },
      };
    },
    client: params.client,
    fixtureIdentifierCache: params.fixtureIdentifierCache,
    delayBetweenCallsMilliseconds: params.delayBetweenCallsMilliseconds,
  });

  await ensureSmokeTestRecordExists({
    fixtureResourcePath: 'transactions',
    listToolName: 'COUNT_list_transactions',
    createToolName: 'COUNT_create_transaction',
    buildCreateToolInput: (buildParams) => {
      const bankAccountIdentifier =
        buildParams.fixtureIdentifierCache.supportingAccountIdentifiers.bankAccountIdentifier;
      const expenseCategoryAccountIdentifier =
        buildParams.fixtureIdentifierCache.supportingAccountIdentifiers.expenseCategoryAccountIdentifier;

      if (!bankAccountIdentifier || !expenseCategoryAccountIdentifier) {
        return null;
      }

      return {
        body: {
          accUuid: bankAccountIdentifier,
          amount: '1.00',
          postedDate: smokeTestIsoDate,
          type: 'Expense',
          description: `${SMOKE_TEST_RECORD_LABEL} Transaction`,
          categoryAccountUuid: expenseCategoryAccountIdentifier,
        },
      };
    },
    client: params.client,
    fixtureIdentifierCache: params.fixtureIdentifierCache,
    delayBetweenCallsMilliseconds: params.delayBetweenCallsMilliseconds,
  });

  const listProjectTasksTool = getToolDefinition({ toolName: 'COUNT_list_project_tasks' });
  if (listProjectTasksTool && params.fixtureIdentifierCache.fixtureIdentifiersByResourcePath.projects) {
    await executeListToolForFixtureSeeding({
      listTool: listProjectTasksTool,
      client: params.client,
      fixtureIdentifierCache: params.fixtureIdentifierCache,
    });
  }
}
