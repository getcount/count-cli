# COUNT CLI — partner login and local MCP

The COUNT CLI (`@count/cli`, binary `count`) is the supported path for **Claude Code**, **Cursor**, and other **CLI/agent** integrations that need programmatic access across one or more COUNT workspaces.

It wraps the existing Partner OAuth flow and launches the local `@count/partner-mcp` stdio server — the same `COUNT_*` tools exposed by `https://api.getcount.com/mcp`, without relying on remote MCP OAuth loopback quirks.

## When to use the CLI vs remote MCP

| Surface | Use |
| --- | --- |
| Claude.ai / ChatGPT web connectors | `https://api.getcount.com/mcp` |
| Claude Code, Cursor, custom agents, multi-workspace automation | `count` CLI + local MCP |

## Prerequisites

1. A COUNT user account with access to the workspaces you need.
2. A partner app created at [app.getcount.com/count-partners](https://app.getcount.com/count-partners).
3. Redirect URI registered on that app:

```text
http://127.0.0.1:17845/callback
```

You can change the port with `count login --port <port>`; the registered URI must match exactly (or sit under a registered prefix per partner redirect rules).

## Install

From this repository (after `@count/partner-mcp` is available on npm):

```bash
npm install
npm run build
npm link
```

Until `@count/partner-mcp` is published, build and link it from the [count-api](https://github.com/NotAllTalk/count-api) monorepo first:

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

## Workflow

```bash
count init --client-id "$CLIENT_ID" --client-secret "$CLIENT_SECRET"
count login
count status
count mcp print-config   # paste into Claude Code MCP settings
count mcp                # or run the stdio server directly
```

Credentials are stored in `~/.count/credentials.json` (mode `600`).

## Claude Code configuration

After `count login`, run:

```bash
count mcp print-config
```

Paste the JSON into your Claude Code MCP configuration. The server uses Node to run `@count/partner-mcp` with your stored tokens.

## Multiple workspaces

Each `count login` completes OAuth for **one workspace**. Repeat `count login` for additional workspaces and store separate credential files manually, or run separate COUNT partner apps per workspace automation account.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Invalid redirect uri` during login | Add `http://127.0.0.1:17845/callback` to the partner app redirect URIs |
| `Partner credentials are not configured` | Run `count init` |
| `You are not logged in` | Run `count login` |
| MCP tools return 401 | Run `count login` again to refresh stored tokens |

## Related docs

- [developers.getcount.com](https://developers.getcount.com) — Partner REST API reference
