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

export const describeEndpointInputSchema = z.object({
  toolName: z
    .string()
    .min(1)
    .describe('Exact name of the COUNT_* tool you want guidance for, e.g. "COUNT_create_invoice".'),
});
