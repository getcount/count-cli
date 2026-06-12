import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { PartnerApiClient, PartnerApiError } from '../partnerApiClient.js';
import type { JsonObject, QueryParams, ToolDefinition } from '../types.js';
import { getToolDefinition, toolDefinitions } from './definitions.js';

interface RegisterToolsParams {
  server: McpServer;
  client: PartnerApiClient;
}

interface ExecuteToolParams {
  tool: ToolDefinition;
  input: Record<string, unknown>;
  client: PartnerApiClient;
}

interface BuildAnnotationsParams {
  tool: ToolDefinition;
}

interface SuccessResultParams {
  result: unknown;
}

interface ErrorResultParams {
  error: unknown;
}

interface GetQueryParams {
  input: Record<string, unknown>;
}

interface GetBodyParams {
  input: Record<string, unknown>;
}

interface InterpolatePathParams {
  pathTemplate: string;
  input: Record<string, unknown>;
}

export function registerTools(params: RegisterToolsParams): void {
  const { server, client } = params;

  for (const tool of toolDefinitions) {
    (server as any).registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: { result: z.unknown() },
        annotations: buildAnnotations({ tool }),
      },
      async (input: Record<string, unknown>) => executeTool({ tool, input, client }),
    );
  }
}

function buildAnnotations(params: BuildAnnotationsParams): ToolAnnotations {
  const { tool } = params;
  return {
    title: tool.title,
    readOnlyHint: tool.readOnly,
    destructiveHint: tool.destructive,
    idempotentHint: tool.idempotent ?? tool.readOnly,
    openWorldHint: false,
  };
}

async function executeTool(params: ExecuteToolParams): Promise<CallToolResult> {
  const { tool, input, client } = params;

  try {
    if (tool.name === 'COUNT_auth_status') {
      return successResult({ result: client.getAuthState() });
    }

    if (tool.name === 'COUNT_refresh_access_token') {
      await client.refreshAccessToken();
      return successResult({ result: client.getAuthState() });
    }

    if (tool.name === 'COUNT_describe_endpoint') {
      const targetName = typeof input.toolName === 'string' ? input.toolName : '';
      const target = getToolDefinition({ toolName: targetName });
      if (!target) {
        return errorResult({
          error: new Error(
            `Unknown tool "${targetName}". Available COUNT_* tools can be discovered via list_tools.`,
          ),
        });
      }
      return successResult({
        result: {
          name: target.name,
          title: target.title,
          description: target.description,
          method: target.method,
          partnerApiPath: target.pathTemplate,
          readOnly: target.readOnly,
          destructive: target.destructive,
          // Body / query schemas evolve in lockstep with the partner API so the
          // canonical reference for field names lives in the public docs. We
          // point clients there explicitly to avoid drifting documentation.
          documentation: 'https://developers.getcount.com/',
          tips: buildTips({ target }),
        },
      });
    }

    const path = interpolatePath({ pathTemplate: tool.pathTemplate, input });
    const response = await client.request({
      method: tool.method,
      path,
      query: getQuery({ input }),
      body: getBody({ input }),
      requiresUserAuth: tool.requiresUserAuth,
    });

    return successResult({ result: response });
  } catch (error: unknown) {
    return errorResult({ error });
  }
}

interface BuildTipsParams {
  target: ToolDefinition;
}

interface IsReportEndpointParams {
  target: ToolDefinition;
}

// Mirrors `buildTips` in src/modules/app/mcpServer/tools/registerTools.ts so
// the standalone server returns the same hint set for COUNT_describe_endpoint
// that the in-process server returns. Any change to either side should be
// mirrored to keep the two MCP surfaces consistent.
function buildTips(params: BuildTipsParams): string[] {
  const { target } = params;
  const tips: string[] = [];
  const isReportEndpoint = checkIsReportEndpoint({ target });
  if (target.pathTemplate.includes('{id}')) {
    tips.push(
      'Pass `id` as the external COUNT UUID (the value the API returns under `id` or `uuid`). Do not pass internal numeric ids.',
    );
  }
  if (isReportEndpoint) {
    tips.push(
      'Pass report filters under a top-level `query` key (e.g. { query: { startDate: "2026-01-01", endDate: "2026-12-31" } }). Do not put report filters under `body`.',
    );
  } else if (target.method === 'POST' || target.method === 'PUT' || target.method === 'PATCH') {
    tips.push('Wrap the partner API JSON payload under a top-level `body` key. Field names match the partner API exactly.');
  }
  if (target.method === 'GET') {
    tips.push('Pass any pagination / filter parameters under a top-level `query` key (e.g. { query: { limit: 50 } }).');
  }
  if (target.destructive) {
    tips.push('This tool deletes or invalidates data and cannot be undone.');
  }
  return tips;
}

function checkIsReportEndpoint(params: IsReportEndpointParams): boolean {
  const { target } = params;
  return target.pathTemplate.startsWith('/partners/reports/');
}

function interpolatePath(params: InterpolatePathParams): string {
  const { pathTemplate, input } = params;
  if (!pathTemplate.includes('{id}')) {
    return pathTemplate;
  }

  const id = input.id;
  if (typeof id !== 'string' || id.trim() === '') {
    throw new Error('This tool requires a non-empty id.');
  }

  return pathTemplate.replace('{id}', encodeURIComponent(id));
}

function getQuery(params: GetQueryParams): QueryParams | undefined {
  const { input } = params;
  const query = input.query;
  if (!query || typeof query !== 'object' || Array.isArray(query)) {
    return undefined;
  }

  return query as QueryParams;
}

function getBody(params: GetBodyParams): JsonObject | undefined {
  const { input } = params;
  const body = input.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return undefined;
  }

  return body as JsonObject;
}

function successResult(params: SuccessResultParams): CallToolResult {
  const { result } = params;
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
    structuredContent: {
      result,
    },
  };
}

function errorResult(params: ErrorResultParams): CallToolResult {
  const { error } = params;
  if (error instanceof PartnerApiError) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              message: error.message,
              statusCode: error.statusCode,
              responseBody: error.responseBody,
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: message,
      },
    ],
  };
}

