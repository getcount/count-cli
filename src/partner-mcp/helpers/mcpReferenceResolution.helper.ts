import type { QueryParams } from '../types.js';

export interface McpReferenceResolutionPartnerClient {
  request(params: {
    method: 'GET';
    path: string;
    query?: QueryParams;
    requiresUserAuth?: boolean;
  }): Promise<unknown>;
}

export type McpReferenceMatchConfidence = 'exact' | 'fuzzy' | 'ambiguous' | 'not_found';

export interface McpReferenceResolutionCandidate {
  uuid: string;
  name: string;
}

export interface McpReferenceResolutionFieldResult {
  field: string;
  searchTerm: string;
  uuid: string | null;
  name: string | null;
  matchConfidence: McpReferenceMatchConfidence;
  issue?: 'not_found' | 'ambiguous';
  candidates?: McpReferenceResolutionCandidate[];
}

interface ResolveMcpReferencesParams {
  client: McpReferenceResolutionPartnerClient;
  vendorName?: string;
  customerName?: string;
  customerEmail?: string;
  accountName?: string;
  accountType?: string;
  projectName?: string;
  tagName?: string;
}

interface ResolveMcpReferencesResult {
  resolutions: McpReferenceResolutionFieldResult[];
}

interface ListRecord {
  uuid: string;
  name: string;
}

interface CustomerEmailListRecord {
  uuid: string;
  name: string;
  emailAddresses: string[];
}

interface FetchListRecordsParams {
  client: McpReferenceResolutionPartnerClient;
  path: string;
  search: string;
  extraQuery?: QueryParams;
  recordsKey: string;
  nameField: string;
}

interface FetchCustomerEmailRecordsParams {
  client: McpReferenceResolutionPartnerClient;
  search: string;
}

interface ScoreNameMatchParams {
  searchTerm: string;
  candidateName: string;
}

interface ScoreEmailMatchParams {
  searchTerm: string;
  candidateEmail: string;
}

interface ScoreNameMatchResult {
  score: number;
  matchConfidence: McpReferenceMatchConfidence;
}

interface BuildFieldResolutionParams {
  field: string;
  searchTerm: string;
  records: ListRecord[];
}

interface BuildEmailFieldResolutionParams {
  field: string;
  searchTerm: string;
  records: CustomerEmailListRecord[];
}

const LIST_PAGE_LIMIT = 100;
const REFERENCE_RESOLUTION_MAX_PAGES = 50;

async function fetchListRecords(params: FetchListRecordsParams): Promise<ListRecord[]> {
  const { client, path, search, extraQuery, recordsKey, nameField } = params;
  const accumulatedRecords: ListRecord[] = [];
  let page = 1;

  while (page <= REFERENCE_RESOLUTION_MAX_PAGES) {
    const query: QueryParams = {
      ...(extraQuery ?? {}),
      search,
      limit: LIST_PAGE_LIMIT,
      page,
    };

    const response = await client.request({
      method: 'GET',
      path,
      query,
      requiresUserAuth: true,
    });

    const pageRecords = parseListRecordsFromResponse({ response, recordsKey, nameField });
    accumulatedRecords.push(...pageRecords);

    if (pageRecords.length < LIST_PAGE_LIMIT) {
      break;
    }

    page += 1;
  }

  return accumulatedRecords;
}

interface ParseListRecordsFromResponseParams {
  response: unknown;
  recordsKey: string;
  nameField: string;
}

function parseListRecordsFromResponse(params: ParseListRecordsFromResponseParams): ListRecord[] {
  const { response, recordsKey, nameField } = params;
  const rawRecords = extractRecordsArray({ response, recordsKey });
  const listRecords: ListRecord[] = [];

  for (const rawRecord of rawRecords) {
    if (!rawRecord || typeof rawRecord !== 'object') continue;
    const recordObject = rawRecord as Record<string, unknown>;
    const uuid = extractRecordUuid({ recordObject });
    const nameValue = recordObject[nameField];
    if (!uuid || typeof nameValue !== 'string' || nameValue.trim() === '') continue;
    listRecords.push({ uuid, name: nameValue.trim() });
  }

  return listRecords;
}

async function fetchCustomerEmailRecords(params: FetchCustomerEmailRecordsParams): Promise<CustomerEmailListRecord[]> {
  const { client, search } = params;
  const accumulatedRecords: CustomerEmailListRecord[] = [];
  let page = 1;

  while (page <= REFERENCE_RESOLUTION_MAX_PAGES) {
    const response = await client.request({
      method: 'GET',
      path: '/partners/customers',
      query: {
        search,
        limit: LIST_PAGE_LIMIT,
        page,
      },
      requiresUserAuth: true,
    });

    const rawRecords = extractRecordsArray({ response, recordsKey: 'customers' });
    const pageRecords: CustomerEmailListRecord[] = [];

    for (const rawRecord of rawRecords) {
      if (!rawRecord || typeof rawRecord !== 'object') continue;
      const recordObject = rawRecord as Record<string, unknown>;
      const uuid = extractRecordUuid({ recordObject });
      const customerName = recordObject.customer;
      if (!uuid || typeof customerName !== 'string' || customerName.trim() === '') continue;

      const emailAddresses = extractCustomerEmailAddresses({ recordObject });
      pageRecords.push({
        uuid,
        name: customerName.trim(),
        emailAddresses,
      });
    }

    accumulatedRecords.push(...pageRecords);

    if (pageRecords.length < LIST_PAGE_LIMIT) {
      break;
    }

    page += 1;
  }

  return accumulatedRecords;
}

export async function resolveMcpReferences(params: ResolveMcpReferencesParams): Promise<ResolveMcpReferencesResult> {
  const { client } = params;
  const resolutions: McpReferenceResolutionFieldResult[] = [];

  if (params.vendorName && params.vendorName.trim() !== '') {
    const vendorRecords = await fetchListRecords({
      client,
      path: '/partners/vendors',
      search: params.vendorName.trim(),
      recordsKey: 'vendors',
      nameField: 'name',
    });
    resolutions.push(
      buildFieldResolution({ field: 'vendorName', searchTerm: params.vendorName.trim(), records: vendorRecords })
    );
  }

  if (params.customerName && params.customerName.trim() !== '') {
    const customerRecords = await fetchListRecords({
      client,
      path: '/partners/customers',
      search: params.customerName.trim(),
      recordsKey: 'customers',
      nameField: 'customer',
    });
    resolutions.push(
      buildFieldResolution({ field: 'customerName', searchTerm: params.customerName.trim(), records: customerRecords })
    );
  }

  if (params.customerEmail && params.customerEmail.trim() !== '') {
    const customerEmailRecords = await fetchCustomerEmailRecords({
      client,
      search: params.customerEmail.trim(),
    });
    resolutions.push(
      buildEmailFieldResolution({
        field: 'customerEmail',
        searchTerm: params.customerEmail.trim(),
        records: customerEmailRecords,
      })
    );
  }

  if (params.accountName && params.accountName.trim() !== '') {
    const accountExtraQuery: QueryParams = {};
    if (params.accountType && params.accountType.trim() !== '') {
      accountExtraQuery.type = params.accountType.trim();
    }
    const accountRecords = await fetchListRecords({
      client,
      path: '/partners/chart-of-accounts',
      search: params.accountName.trim(),
      extraQuery: accountExtraQuery,
      recordsKey: 'accounts',
      nameField: 'name',
    });
    resolutions.push(
      buildFieldResolution({ field: 'accountName', searchTerm: params.accountName.trim(), records: accountRecords })
    );
  }

  if (params.projectName && params.projectName.trim() !== '') {
    const projectRecords = await fetchListRecords({
      client,
      path: '/partners/projects',
      search: params.projectName.trim(),
      recordsKey: 'projects',
      nameField: 'name',
    });
    resolutions.push(
      buildFieldResolution({ field: 'projectName', searchTerm: params.projectName.trim(), records: projectRecords })
    );
  }

  if (params.tagName && params.tagName.trim() !== '') {
    const tagRecords = await fetchListRecords({
      client,
      path: '/partners/tags',
      search: params.tagName.trim(),
      recordsKey: 'tags',
      nameField: 'name',
    });
    resolutions.push(
      buildFieldResolution({ field: 'tagName', searchTerm: params.tagName.trim(), records: tagRecords })
    );
  }

  return { resolutions };
}

interface ExtractCustomerEmailAddressesParams {
  recordObject: Record<string, unknown>;
}

function extractCustomerEmailAddresses(params: ExtractCustomerEmailAddressesParams): string[] {
  const { recordObject } = params;
  const emailAddresses: string[] = [];

  if (typeof recordObject.email === 'string' && recordObject.email.trim() !== '') {
    emailAddresses.push(recordObject.email.trim());
  }

  const contacts = recordObject.contacts;
  if (Array.isArray(contacts)) {
    for (const contact of contacts) {
      if (!contact || typeof contact !== 'object') continue;
      const contactEmail = (contact as Record<string, unknown>).email;
      if (typeof contactEmail === 'string' && contactEmail.trim() !== '') {
        emailAddresses.push(contactEmail.trim());
      }
    }
  }

  return emailAddresses;
}

interface ExtractRecordsArrayParams {
  response: unknown;
  recordsKey: string;
}

function extractRecordsArray(params: ExtractRecordsArrayParams): unknown[] {
  const { response, recordsKey } = params;
  if (!response || typeof response !== 'object') return [];

  const responseObject = response as Record<string, unknown>;
  const directArray = responseObject[recordsKey];
  if (Array.isArray(directArray)) return directArray;

  const dataObject = responseObject.data;
  if (dataObject && typeof dataObject === 'object') {
    const nestedArray = (dataObject as Record<string, unknown>)[recordsKey];
    if (Array.isArray(nestedArray)) return nestedArray;
  }

  return [];
}

interface ExtractRecordUuidParams {
  recordObject: Record<string, unknown>;
}

function extractRecordUuid(params: ExtractRecordUuidParams): string | null {
  const { recordObject } = params;
  if (typeof recordObject.id === 'string' && recordObject.id.trim() !== '') {
    return recordObject.id.trim();
  }
  if (typeof recordObject.uuid === 'string' && recordObject.uuid.trim() !== '') {
    return recordObject.uuid.trim();
  }
  return null;
}

export function scoreNameMatch(params: ScoreNameMatchParams): ScoreNameMatchResult {
  const normalizedSearch = params.searchTerm.trim().toLowerCase();
  const normalizedCandidate = params.candidateName.trim().toLowerCase();

  if (normalizedSearch === normalizedCandidate) {
    return { score: 100, matchConfidence: 'exact' };
  }
  if (normalizedCandidate.startsWith(normalizedSearch)) {
    return { score: 80, matchConfidence: 'fuzzy' };
  }
  if (normalizedCandidate.includes(normalizedSearch)) {
    return { score: 60, matchConfidence: 'fuzzy' };
  }
  return { score: 0, matchConfidence: 'not_found' };
}

export function scoreEmailMatch(params: ScoreEmailMatchParams): ScoreNameMatchResult {
  const normalizedSearch = params.searchTerm.trim().toLowerCase();
  const normalizedCandidateEmail = params.candidateEmail.trim().toLowerCase();

  if (normalizedSearch === normalizedCandidateEmail) {
    return { score: 100, matchConfidence: 'exact' };
  }
  return { score: 0, matchConfidence: 'not_found' };
}

function buildFieldResolution(params: BuildFieldResolutionParams): McpReferenceResolutionFieldResult {
  const { field, searchTerm, records } = params;

  if (records.length === 0) {
    return {
      field,
      searchTerm,
      uuid: null,
      name: null,
      matchConfidence: 'not_found',
      issue: 'not_found',
    };
  }

  const scoredRecords = records
    .map((_record) => ({
      record: _record,
      ...scoreNameMatch({ searchTerm, candidateName: _record.name }),
    }))
    .filter((_scored) => _scored.score > 0)
    .sort((_left, _right) => _right.score - _left.score);

  if (scoredRecords.length === 0) {
    return {
      field,
      searchTerm,
      uuid: null,
      name: null,
      matchConfidence: 'not_found',
      issue: 'not_found',
    };
  }

  const topScore = scoredRecords[0].score;
  const topMatches = scoredRecords.filter((_scored) => _scored.score === topScore);

  if (topMatches.length > 1) {
    return {
      field,
      searchTerm,
      uuid: null,
      name: null,
      matchConfidence: 'ambiguous',
      issue: 'ambiguous',
      candidates: topMatches.slice(0, 5).map((_scored) => ({
        uuid: _scored.record.uuid,
        name: _scored.record.name,
      })),
    };
  }

  const bestMatch = topMatches[0];
  return {
    field,
    searchTerm,
    uuid: bestMatch.record.uuid,
    name: bestMatch.record.name,
    matchConfidence: bestMatch.matchConfidence,
  };
}

function buildEmailFieldResolution(params: BuildEmailFieldResolutionParams): McpReferenceResolutionFieldResult {
  const { field, searchTerm, records } = params;

  if (records.length === 0) {
    return {
      field,
      searchTerm,
      uuid: null,
      name: null,
      matchConfidence: 'not_found',
      issue: 'not_found',
    };
  }

  const scoredRecords = records
    .map((_record) => {
      let bestScore = 0;
      let bestMatchConfidence: McpReferenceMatchConfidence = 'not_found';

      for (const emailAddress of _record.emailAddresses) {
        const emailScore = scoreEmailMatch({ searchTerm, candidateEmail: emailAddress });
        if (emailScore.score > bestScore) {
          bestScore = emailScore.score;
          bestMatchConfidence = emailScore.matchConfidence;
        }
      }

      return {
        record: _record,
        score: bestScore,
        matchConfidence: bestMatchConfidence,
      };
    })
    .filter((_scored) => _scored.score > 0)
    .sort((_left, _right) => _right.score - _left.score);

  if (scoredRecords.length === 0) {
    return {
      field,
      searchTerm,
      uuid: null,
      name: null,
      matchConfidence: 'not_found',
      issue: 'not_found',
    };
  }

  const topScore = scoredRecords[0].score;
  const topMatches = scoredRecords.filter((_scored) => _scored.score === topScore);

  if (topMatches.length > 1) {
    return {
      field,
      searchTerm,
      uuid: null,
      name: null,
      matchConfidence: 'ambiguous',
      issue: 'ambiguous',
      candidates: topMatches.slice(0, 5).map((_scored) => ({
        uuid: _scored.record.uuid,
        name: _scored.record.name,
      })),
    };
  }

  const bestMatch = topMatches[0];
  return {
    field,
    searchTerm,
    uuid: bestMatch.record.uuid,
    name: bestMatch.record.name,
    matchConfidence: bestMatch.matchConfidence,
  };
}
