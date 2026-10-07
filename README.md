# com.paca.gitlab

Plugin first-party Paca che collega **progetti GitLab**, **merge request** e **branch** a progetti e task Paca.

Port del plugin GitHub (`com.paca.github`) verso GitLab. Il **codice e la CI restano su GitHub**; il prodotto parla con GitLab.com (e, nel codice, con Self-Managed via URL opzionale).

Documentazione GitLab di riferimento: [docs.gitlab.com](https://docs.gitlab.com/) · [REST API](https://docs.gitlab.com/ee/api/rest/) · [Project webhooks](https://docs.gitlab.com/user/project/integrations/webhooks/) · [Access token scopes](https://docs.gitlab.com/security/tokens/access_token_scopes/) · [MCP server ufficiale](https://docs.gitlab.com/user/model_context_protocol/mcp_server/)

---

## Cosa fa

- Salva un access token GitLab (cifrato) per progetto Paca
- Elenca e collega progetti GitLab accessibili dal token
- Crea webhook sul progetto collegato (push, merge request, pipeline)
- Su ogni task Paca: crea/linka branch e merge request, commenti, review, stato CI (pipelines)
- Espone trigger/condizioni/azioni di automazione (`gitlab.mr_*`, `gitlab.branch_linked`, …)
- Bundle MCP + skill `paca-gitlab-workflow` centrati sul *link al task Paca* (non sostituiscono il [MCP ufficiale GitLab](https://docs.gitlab.com/user/model_context_protocol/mcp_server/))

---

## Differenze rispetto al plugin GitHub

| | GitHub (`com.paca.github`) | GitLab (`com.paca.gitlab`) |
|--|---------------------------|----------------------------|
| Oggetto | Pull request | Merge request (`iid`) |
| Auth | PAT | Personal **o** Project **o** Group Access Token |
| Host API | `api.github.com` fisso | `instance_url` (default `https://gitlab.com`) |
| Webhook | `X-Hub-Signature-256` | `signing_token` HMAC (GitLab **19+**, Standard Webhooks) |
| CI | Checks / commit status | Pipelines MR |
| Review | PR reviews | Note + Approvals API (`APPROVE` / `REQUEST_CHANGES` / `COMMENT`) |
| UI | inglese | i18n **en** + **it** |

---

## Setup

### Config host Paca

| Chiave | Obbligatoria | Descrizione |
|--------|--------------|-------------|
| `ENCRYPTION_KEY` | sì | 64 caratteri hex (chiave AES-256-GCM per token e signing token webhook) |
| `PUBLIC_URL` | sì per i webhook | URL pubblico del server Paca (callback webhook) |

Senza `PUBLIC_URL` il link di un progetto GitLab fallisce: la creazione webhook richiede un URL raggiungibile.

Outbound in `plugin.json`: `gitlab.com`. Per un’istanza Self-Managed andrebbe aggiunto l’hostname in `allowedOutboundDomains` prima del build (test Self-Managed non in scope per ora).

### Token GitLab

Supportati (obbligatori in prodotto):

1. **Personal Access Token**
2. **Project Access Token**
3. **Group Access Token**

Scope consigliato: [`api`](https://docs.gitlab.com/security/tokens/access_token_scopes/).  
Per creare project webhook serve ruolo **Maintainer** o **Owner** sul progetto GitLab ([webhooks](https://docs.gitlab.com/user/project/integrations/webhooks/)).

In Project Settings → **GitLab**:

- **Instance URL** (opzionale): default `https://gitlab.com`
- **Token type**: personal / project / group
- **Access token**: valore del token

Project/Group token vedono solo il proprio scope: la lista “accessible projects” può essere corta o un solo progetto — è normale.

### Webhook (GitLab 19+)

Alla link di un progetto il plugin crea un hook con:

- `push_events`, `merge_requests_events`, `pipeline_events`
- **`signing_token`** (`whsec_…`) — path primario di verifica (niente secret token legacy)

Header attesi in ingresso: `X-Gitlab-Event`, `webhook-id`, `webhook-timestamp`, `webhook-signature`.

---

## Architettura

```text
├── backend/   Go → WASM (plugin-sdk-go), schema plugin_data_com_paca_gitlab
├── frontend/  React Module Federation + i18n (en/it)
├── mcp/       Tool MCP Paca-centrici
└── skills/    paca-gitlab-workflow
```

Plugin ID: `com.paca.gitlab` · permesso custom: `gitlab.manage`

### Route principali

Prefisso host: `/api/v1/plugins/com.paca.gitlab/projects/:projectId/…`

| Metodo | Path | Note |
|--------|------|------|
| GET/POST/DELETE | `/integration`, `/integration/token` | stato + set/remove token (`instance_url`, `token_kind`) |
| GET | `/integration/accessible-repos` | progetti visibili al token |
| GET/POST/DELETE | `/repositories`… | link/unlink + webhook |
| * | `/tasks/:taskId/pull-requests`… | MR (path legacy “pull-requests”, semantica MR) |
| * | `/tasks/:taskId/branches`… | branch |
| POST | `/webhook` | pubblico (firma signing_token) |

---

## i18n

Frontend: cataloghi `en` e `it` in `frontend/src/i18n/`.  
Locale da prop host `locale` oppure `navigator.language` (fallback `en`).

---

## Sviluppo

### Backend

```bash
cd backend
go test ./...
tinygo build -target=wasip1 -buildmode=c-shared -o gitlab.wasm .
```

### Frontend / MCP

```bash
cd frontend && bun install && bun run typecheck && bun run build
cd mcp && bun install && bun run typecheck && bun run build
```

### Release

Workflow GitHub Actions: `.github/workflows/release.yml` su tag `v*` → artifact `gitlab-*.tar.gz`.

---

## Note

- **Self-Managed:** campo `instance_url` presente; smoke/test su istanze private **deferred** finché non c’è un’istanza da usare. Validazione primaria prevista su GitLab.com.
- Coesistenza GitHub+GitLab sullo stesso progetto Paca: **non** in scope.
- Minimo GitLab: **19+** (firma webhook `signing_token`).
