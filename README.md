# com.paca.gitlab

First-party Paca plugin that integrates GitLab projects, merge requests, and branches with Paca projects and tasks.

Forked from `com.paca.github` and ported to GitLab. **Source/CI/release stay on GitHub**; the product integrates GitLab.com and Self-Managed (19+).

---

## Architecture

```text
├── backend/   - Go WASM plugin (runs inside the API host)
├── frontend/  - React micro-frontend (Module Federation remote) + i18n (en/it)
└── mcp/       - MCP tools bundle for AI/tooling integrations (Paca task-centric)
```

GitLab also ships an [official MCP server](https://docs.gitlab.com/user/model_context_protocol/mcp_server/) at `/api/v4/mcp`. The plugin MCP remains required for linking MRs/branches to Paca tasks; use the official MCP as a semantic/API reference.

### Auth

- **Personal**, **Project**, and **Group** Access Tokens (all supported).
- Scope: `api`. Creating project webhooks requires **Maintainer** or **Owner**.
- Per-integration `instance_url` (default `https://gitlab.com`).
- Tokens encrypted with AES-256-GCM (`ENCRYPTION_KEY`).

### Webhooks (GitLab 19+)

- Events: push, merge request, pipeline.
- Verification: `signing_token` (Standard Webhooks HMAC) — primary path.

### Config

- `ENCRYPTION_KEY`: 64 hex chars.
- `PUBLIC_URL`: public Paca base URL for webhook callbacks.
- Outbound allowlist in `plugin.json`: `gitlab.com`. For Self-Managed, add your hostname to `allowedOutboundDomains` before building.

---

## Development

### Backend

```bash
cd backend
go test ./...
tinygo build -target=wasip1 -buildmode=c-shared -o gitlab.wasm .
```

### Frontend / MCP

```bash
cd frontend && bun install && bun run build
cd mcp && bun install && bun run build
```

Release: `.github/workflows/release.yml` on tag `v*`.
