# COUNT CLI (`@count/cli`)

Command-line tool for partner integrations that need **low-friction OAuth login** and a **local MCP server** for Claude Code, Cursor, and other agent runtimes.

## Install

When `@count/partner-mcp` is published to npm:

```bash
npm install
npm run build
npm link
```

Until then, link `@count/partner-mcp` from the [count-api](https://github.com/NotAllTalk/count-api) monorepo:

```bash
cd /path/to/count-api
npm install
npm run mcp:count:build
npm link --workspace @count/partner-mcp

cd /path/to/count-cli
npm link @count/partner-mcp
npm install
npm run build
npm link
```

When published to npm:

```bash
npm install -g @count/cli
```

## Quick start

### 1. Create a partner app

Open [COUNT Partners](https://app.getcount.com/count-partners), create an app, and add this redirect URI:

```text
http://127.0.0.1:17845/callback
```

### 2. Save credentials

```bash
count init \
  --client-id "<your-client-id>" \
  --client-secret "<your-client-secret>"
```

### 3. Sign in

```bash
count login
```

This opens `partner-signin`, lets you pick a workspace, stores access/refresh tokens in `~/.count/credentials.json`, and returns you to the terminal.

### 4. Run MCP locally

```bash
count mcp
```

Or print Claude Code configuration:

```bash
count mcp print-config
```

## Commands

| Command | Description |
| --- | --- |
| `count init` | Save `client_id` / `client_secret` |
| `count login` | Browser OAuth login + token storage |
| `count logout` | Delete `~/.count/credentials.json` |
| `count status` | Show whether credentials/tokens are present |
| `count mcp` | Start the local `@count/partner-mcp` stdio server |
| `count mcp print-config` | Emit MCP JSON for Claude Code / Cursor |

## Environment

The CLI reads the API host from `count init --api-url` (default `https://api.getcount.com`).

Stored credentials live at:

```text
~/.count/credentials.json
```

File mode is `600`.

## Docs

- Full guide: [`docs/count-cli.md`](./docs/count-cli.md)
- Partner API reference: [developers.getcount.com](https://developers.getcount.com)
