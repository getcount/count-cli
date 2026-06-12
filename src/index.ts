#!/usr/bin/env node
import { CLI_VERSION } from './constants.js';
import { createCli } from './cli.js';

async function main(): Promise<void> {
  const program = createCli({ version: CLI_VERSION });
  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`count: ${message}\n`);
  process.exit(1);
});
