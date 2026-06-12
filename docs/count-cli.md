# COUNT CLI — partner login and local MCP

The COUNT CLI (`@countfinancial/cli`, binary `count`) is the supported path for **Claude Code**, **Cursor**, and other **CLI/agent** integrations that need programmatic access across one or more COUNT workspaces.

It bundles the COUNT Partner MCP server and the same `COUNT_*` tools exposed by `https://api.getcount.com/mcp`, without relying on remote MCP OAuth loopback quirks.

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

```bash
npm install -g @countfinancial/cli
```

From this repository:

```bash
npm install
npm run build
npm link
```

## Workflow

```bash
count init --client-id "$CLIENT_ID" --client-secret "$CLIENT_SECRET"
count login
count status
count mcp print-config   # paste into Claude Code / Cursor MCP settings
count mcp                # or run the stdio server directly
```

Credentials are stored in `~/.count/credentials.json` (mode `600`). Refreshed access tokens are written back to that file automatically during MCP sessions.

## Claude Code / Cursor configuration

After `count login`, run:

```bash
count mcp print-config
```

Paste the JSON into your MCP configuration. The config points at the `count mcp` command, which loads credentials from `~/.count/credentials.json` at runtime — no secrets are embedded in the MCP config file.

Example output:

```json
{
  "mcpServers": {
    "count": {
      "command": "/path/to/node",
      "args": ["/path/to/@countfinancial/cli/dist/index.js", "mcp"]
    }
  }
}
```

## Multiple workspaces

Each `count login` completes OAuth for **one workspace**. Repeat `count login` for additional workspaces and store separate credential files manually, or run separate COUNT partner apps per workspace automation account.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Invalid redirect uri` during login | Add `http://127.0.0.1:17845/callback` to the partner app redirect URIs |
| `Partner credentials are not configured` | Run `count init` |
| `You are not logged in` | Run `count login` |
| MCP tools return 401 | Run `count login` again to refresh stored tokens |
| Windows: `'clientName' is not recognized...` during login | Upgrade to `@countfinancial/cli@0.1.6` or later — older versions broke OAuth URLs containing `&` |
| Windows: browser opens but login page shows an error | Same as above; or run `count login --no-open` and paste the full URL manually |

## Related docs

- [developers.getcount.com](https://developers.getcount.com) — Partner REST API reference
