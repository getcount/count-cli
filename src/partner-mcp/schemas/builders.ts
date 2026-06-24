import { z } from 'zod';
import { resourceIdSchema, versionNumberSchema, workspaceIdSchema } from './primitives.js';

interface BuildQueryToolInputSchemaParams {
  queryObjectSchema: z.ZodObject<z.ZodRawShape>;
  includeWorkspaceId?: boolean;
}

interface BuildBodyToolInputSchemaParams {
  bodyObjectSchema: z.ZodType<Record<string, unknown>>;
  queryObjectSchema?: z.ZodObject<z.ZodRawShape>;
  includeWorkspaceId?: boolean;
}

interface BuildIdQueryToolInputSchemaParams {
  queryObjectSchema?: z.ZodObject<z.ZodRawShape>;
  includeWorkspaceId?: boolean;
}

interface BuildIdBodyToolInputSchemaParams {
  bodyObjectSchema: z.ZodType<Record<string, unknown>>;
  queryObjectSchema?: z.ZodObject<z.ZodRawShape>;
  optionalBody?: boolean;
  includeWorkspaceId?: boolean;
}

interface BuildIdVersionNumberBodyToolInputSchemaParams {
  bodyObjectSchema: z.ZodType<Record<string, unknown>>;
  queryObjectSchema?: z.ZodObject<z.ZodRawShape>;
  optionalBody?: boolean;
  includeWorkspaceId?: boolean;
}

interface BuildEmptyToolInputSchemaParams {
  includeWorkspaceId?: boolean;
}

function withOptionalWorkspaceId(params: {
  schema: z.ZodObject<z.ZodRawShape>;
  includeWorkspaceId?: boolean;
}): z.ZodType<Record<string, unknown>> {
  const { schema, includeWorkspaceId = false } = params;
  if (!includeWorkspaceId) {
    return schema;
  }
  return schema.extend({ workspace_id: workspaceIdSchema });
}

export function buildQueryToolInputSchema(params: BuildQueryToolInputSchemaParams): z.ZodType<Record<string, unknown>> {
  const { queryObjectSchema, includeWorkspaceId = false } = params;
  return withOptionalWorkspaceId({
    includeWorkspaceId,
    schema: z.object({
      query: queryObjectSchema.optional(),
    }),
  });
}

export function buildIdQueryToolInputSchema(
  params: BuildIdQueryToolInputSchemaParams = {},
): z.ZodType<Record<string, unknown>> {
  const { queryObjectSchema, includeWorkspaceId = false } = params;
  if (queryObjectSchema) {
    return withOptionalWorkspaceId({
      includeWorkspaceId,
      schema: z.object({
        id: resourceIdSchema,
        query: queryObjectSchema.optional(),
      }),
    });
  }

  return withOptionalWorkspaceId({
    includeWorkspaceId,
    schema: z.object({
      id: resourceIdSchema,
    }),
  });
}

export function buildBodyToolInputSchema(params: BuildBodyToolInputSchemaParams): z.ZodType<Record<string, unknown>> {
  const { bodyObjectSchema, queryObjectSchema, includeWorkspaceId = false } = params;
  if (queryObjectSchema) {
    return withOptionalWorkspaceId({
      includeWorkspaceId,
      schema: z.object({
        body: bodyObjectSchema,
        query: queryObjectSchema.optional(),
      }),
    });
  }

  return withOptionalWorkspaceId({
    includeWorkspaceId,
    schema: z.object({
      body: bodyObjectSchema,
    }),
  });
}

export function buildIdBodyToolInputSchema(params: BuildIdBodyToolInputSchemaParams): z.ZodType<Record<string, unknown>> {
  const { bodyObjectSchema, queryObjectSchema, optionalBody = false, includeWorkspaceId = false } = params;
  const bodyField = optionalBody ? bodyObjectSchema.optional() : bodyObjectSchema;
  if (queryObjectSchema) {
    return withOptionalWorkspaceId({
      includeWorkspaceId,
      schema: z.object({
        id: resourceIdSchema,
        body: bodyField,
        query: queryObjectSchema.optional(),
      }),
    });
  }

  return withOptionalWorkspaceId({
    includeWorkspaceId,
    schema: z.object({
      id: resourceIdSchema,
      body: bodyField,
    }),
  });
}

export function buildIdVersionNumberBodyToolInputSchema(
  params: BuildIdVersionNumberBodyToolInputSchemaParams,
): z.ZodType<Record<string, unknown>> {
  const { bodyObjectSchema, queryObjectSchema, optionalBody = false, includeWorkspaceId = false } = params;
  const bodyField = optionalBody ? bodyObjectSchema.optional() : bodyObjectSchema;
  if (queryObjectSchema) {
    return withOptionalWorkspaceId({
      includeWorkspaceId,
      schema: z.object({
        id: z.string().min(1).describe('External COUNT budget UUID.'),
        versionNumber: versionNumberSchema,
        body: bodyField,
        query: queryObjectSchema.optional(),
      }),
    });
  }

  return withOptionalWorkspaceId({
    includeWorkspaceId,
    schema: z.object({
      id: z.string().min(1).describe('External COUNT budget UUID.'),
      versionNumber: versionNumberSchema,
      body: bodyField,
    }),
  });
}

export function buildEmptyToolInputSchema(params: BuildEmptyToolInputSchemaParams = {}): z.ZodType<Record<string, unknown>> {
  const { includeWorkspaceId = false } = params;
  return withOptionalWorkspaceId({
    includeWorkspaceId,
    schema: z.object({}),
  });
}
