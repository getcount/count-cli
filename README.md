# COUNT CLI (`@countfinancial/cli`)

Command-line tool for partner integrations that need **low-friction OAuth login** and a **local MCP server** for Claude Code, Cursor, and other agent runtimes.

The MCP server is bundled inside this package — no separate npm install required.

## Install

```bash
npm install -g @countfinancial/cli
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
| `count setup` | Interactive wizard: credentials, login, MCP install, health checks |
| `count doctor` | Run CLI/API health checks |
| `count init` | Save `client_id` / `client_secret` |
| `count login` | Browser OAuth login + token storage |
| `count logout` | Delete stored credentials for the active profile |
| `count status` | Show whether credentials/tokens are present |
| `count profiles list` | List named credential profiles |
| `count profiles add <name>` | Create a profile with partner credentials |
| `count profiles use <name>` | Switch the active profile |
| `count mcp` | Start the local COUNT Partner MCP stdio server |
| `count mcp print-config` | Emit MCP JSON for Claude Code / Cursor |
| `count mcp install` | Write MCP config into Cursor or Claude settings |

Use `--profile <name>` on any command to target a named profile under `~/.count/profiles/`.

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
