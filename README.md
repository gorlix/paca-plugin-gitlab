# com.paca.gitlab

Plugin Paca che collega **progetti GitLab**, **merge request** e **branch** a progetti e task Paca.

Il codice e le release sono su [GitHub](https://github.com/gorlix/paca-plugin-gitlab); il prodotto parla con **GitLab.com** (e Self-Managed via `instance_url`).

| | |
|--|--|
| Plugin ID | `com.paca.gitlab` |
| Versione release | [`v0.5.0`](https://github.com/gorlix/paca-plugin-gitlab/releases/tag/v0.5.0) |
| Paca minimo | `minCoreVersion` **v0.13.3** (vedi `plugin.json`) |
| GitLab minimo | **19+** (webhook con `signing_token`) |
| UI | i18n **it** + **en** |

Documentazione GitLab: [docs.gitlab.com](https://docs.gitlab.com/) · [REST API](https://docs.gitlab.com/ee/api/rest/) · [Project webhooks](https://docs.gitlab.com/user/project/integrations/webhooks/) · [Access token scopes](https://docs.gitlab.com/security/tokens/access_token_scopes/)

---

## Installazione in produzione

Percorso consigliato: scaricare gli artifact della [GitHub Release](https://github.com/gorlix/paca-plugin-gitlab/releases), copiarli nei **named volume** Docker di Paca, registrare il plugin con l’API admin.

> Questo plugin **non** è (ancora) nel catalog marketplace `Paca-AI/paca-plugins`. L’installazione avviene dagli asset della release di questo repo.

### 1. Prerequisiti host Paca

| Requisito | Perché |
|-----------|--------|
| Paca **≥ v0.13.3** | Dichiarato in `plugin.json` come `minCoreVersion` |
| `ENCRYPTION_KEY` | 64 caratteri hex (AES-256-GCM) — cifra token GitLab e signing token webhook. Genera con `openssl rand -hex 32`. **Non cambiare** la chiave dopo aver salvato token. |
| `PUBLIC_URL` | URL pubblico di Paca **senza** slash finale, raggiungibile da GitLab (per i webhook). In produzione: **HTTPS**. |
| Utente admin + API key | Chiave con permessi admin (header `X-API-Key`) |

Con l’installer ufficiale Paca queste variabili finiscono nel `.env` del deploy ([`scripts/install.sh`](https://github.com/Paca-AI/paca/blob/master/scripts/install.sh), [`deploy/README.md`](https://github.com/Paca-AI/paca/blob/master/deploy/README.md)).

Verifica rapida:

```bash
# dalla macchina host dove gira Docker
grep -E '^(ENCRYPTION_KEY|PUBLIC_URL)=' .env
# ENCRYPTION_KEY deve essere 64 hex; PUBLIC_URL tipo https://paca.example.com
curl -sS "${PUBLIC_URL}/api/v1/health"
```

I volumi plugin del compose di produzione (`name: paca`) sono:

| Volume Docker | Mount nel container API | Contenuto |
|---------------|-------------------------|-----------|
| `paca_backend_plugins` | `/plugins` | `backend.wasm`, `plugin.json`, `migrations/` |
| `paca_frontend_plugins` | `/plugins-frontend` | bundle Module Federation |
| `paca_mcp_plugins` | `/plugins-mcp` | `mcp.js` |
| `paca_skills_plugins` | `/plugins-skills` | skill Agent |

Riferimento layout: [docs/plugins/marketplace.md](https://github.com/Paca-AI/paca/blob/master/docs/plugins/marketplace.md) (stesso layout on-disk usato dal marketplace installer).

### 2. Scarica gli artifact della release

```bash
VERSION=v0.5.0
BASE="https://github.com/gorlix/paca-plugin-gitlab/releases/download/${VERSION}"
WORKDIR=$(mktemp -d)
cd "$WORKDIR"

curl -fsSL -O "$BASE/checksums.txt"
for f in \
  gitlab-backend-wasm.tar.gz \
  gitlab-frontend-dist.tar.gz \
  gitlab-mcp-dist.tar.gz \
  gitlab-migrations.tar.gz \
  gitlab-skills-bundle.tar.gz \
  gitlab-plugin-manifest.tar.gz
do
  curl -fsSL -O "$BASE/$f"
done
sha256sum -c checksums.txt
```

### 3. Installa file + registra il plugin

**Opzione A — script in-repo (consigliata)**

Dalla directory di questo repository (o dopo aver scaricato solo lo script):

```bash
export PACA_URL='https://paca.example.com'   # = PUBLIC_URL, no slash finale
export PACA_API_KEY='…'                      # API key admin

./scripts/install-from-release.sh \
  --api-url "$PACA_URL" \
  --api-key "$PACA_API_KEY" \
  --version v0.5.0
```

Lo script verifica i checksum, popola i volume `paca_*_plugins` e chiama `POST /api/v1/admin/plugins` (o `PATCH` se il plugin esiste già). L’API esegue migrazioni e carica il WASM ([handler admin plugins](https://github.com/Paca-AI/paca/blob/master/services/api/internal/transport/http/handler/plugin_handler.go)).

**Opzione B — passi manuali (copy-paste)**

Continua nella stessa `$WORKDIR` del passo 2:

```bash
PLUGIN_ID=com.paca.gitlab
STAGE="$WORKDIR/stage"
mkdir -p \
  "$STAGE/backend/$PLUGIN_ID/migrations" \
  "$STAGE/frontend/$PLUGIN_ID" \
  "$STAGE/mcp/$PLUGIN_ID" \
  "$STAGE/skills/$PLUGIN_ID"

# backend: qualsiasi .wasm della release → backend.wasm (come fa il marketplace installer)
tar -xzf gitlab-backend-wasm.tar.gz -C "$STAGE/backend/$PLUGIN_ID"
mv "$STAGE/backend/$PLUGIN_ID/"*.wasm "$STAGE/backend/$PLUGIN_ID/backend.wasm"
tar -xzf gitlab-plugin-manifest.tar.gz -C "$STAGE/backend/$PLUGIN_ID"
tar -xzf gitlab-migrations.tar.gz -C "$STAGE"
cp "$STAGE/migrations/"*.sql "$STAGE/backend/$PLUGIN_ID/migrations/"

# frontend / mcp: la tar ha una root `dist/` → contenuto in /plugins-*/com.paca.gitlab/
tar -xzf gitlab-frontend-dist.tar.gz -C "$STAGE"
cp -a "$STAGE/dist/." "$STAGE/frontend/$PLUGIN_ID/"
rm -rf "$STAGE/dist"
tar -xzf gitlab-mcp-dist.tar.gz -C "$STAGE"
cp -a "$STAGE/dist/." "$STAGE/mcp/$PLUGIN_ID/"
rm -rf "$STAGE/dist"

# skills: root `skills/` → contenuto sotto com.paca.gitlab/
tar -xzf gitlab-skills-bundle.tar.gz -C "$STAGE"
cp -a "$STAGE/skills/." "$STAGE/skills/$PLUGIN_ID/"

# Copia nei named volume (progetto compose `name: paca`)
docker run --rm \
  -v paca_backend_plugins:/plugins \
  -v paca_frontend_plugins:/plugins-frontend \
  -v paca_mcp_plugins:/plugins-mcp \
  -v paca_skills_plugins:/plugins-skills \
  -v "$STAGE:/stage:ro" \
  alpine:3.20 sh -c "
    set -e
    mkdir -p /plugins /plugins-frontend /plugins-mcp /plugins-skills
    rm -rf /plugins/$PLUGIN_ID /plugins-frontend/$PLUGIN_ID /plugins-mcp/$PLUGIN_ID /plugins-skills/$PLUGIN_ID
    cp -a /stage/backend/$PLUGIN_ID /plugins/
    cp -a /stage/frontend/$PLUGIN_ID /plugins-frontend/
    cp -a /stage/mcp/$PLUGIN_ID /plugins-mcp/
    cp -a /stage/skills/$PLUGIN_ID /plugins-skills/
  "

# Registra (o aggiorna) via API admin
PACA_URL='https://paca.example.com'
PACA_API_KEY='…'
MANIFEST=$(cat "$STAGE/backend/$PLUGIN_ID/plugin.json")
VERSION_NUM=$(echo "$MANIFEST" | jq -r .version)

LIST=$(curl -fsS -H "X-API-Key: $PACA_API_KEY" "$PACA_URL/api/v1/plugins")
EXISTING_ID=$(echo "$LIST" | jq -r --arg n "$PLUGIN_ID" '.data.plugins[]? | select(.name==$n) | .id' | head -n1)

if [[ -n "$EXISTING_ID" && "$EXISTING_ID" != "null" ]]; then
  curl -fsS -X PATCH "$PACA_URL/api/v1/admin/plugins/$EXISTING_ID" \
    -H "X-API-Key: $PACA_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"version\":\"$VERSION_NUM\",\"manifest\":$MANIFEST,\"enabled\":true}"
else
  curl -fsS -X POST "$PACA_URL/api/v1/admin/plugins" \
    -H "X-API-Key: $PACA_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$PLUGIN_ID\",\"version\":\"$VERSION_NUM\",\"manifest\":$MANIFEST,\"enabled\":true}"
fi
echo
```

Se il frontend non si aggiorna subito, riavvia gateway (e api se il load WASM è fallito):

```bash
cd /path/to/paca   # directory con docker-compose.yml
docker compose restart api gateway
```

### 4. Collega GitLab a un progetto Paca

1. Apri il progetto Paca → **Settings** → tab **GitLab** (permesso `gitlab.manage`).
2. **Instance URL** (opzionale): lascia vuoto o `https://gitlab.com`; per Self-Managed inserisci l’URL dell’istanza (es. `https://gitlab.azienda.it`).
3. **Tipo token**: Personal, Project o Group Access Token (tutti supportati).
4. Incolla il token con scope [`api`](https://docs.gitlab.com/security/tokens/access_token_scopes/).
5. Seleziona e **collega** i progetti GitLab visibili al token.

Note sui token:

- **Personal Access Token** — vede i progetti accessibili all’utente.
- **Project / Group Access Token** — scope ristretto: la lista “accessible projects” può mostrare un solo progetto (normale).
- Per creare il webhook sul progetto GitLab serve ruolo **Maintainer** o **Owner**.

Outbound in `plugin.json`: `gitlab.com`. Per Self-Managed con hostname diverso, aggiungi l’host in `allowedOutboundDomains` e **ricostruisci/reinstalla** il plugin (smoke Self-Managed deferred).

### 5. Webhook (GitLab 19+)

Al link di un repository il plugin crea un project webhook con:

- eventi: `push_events`, `merge_requests_events`, `pipeline_events`
- **`signing_token`** (`whsec_…`) — verifica HMAC Standard Webhooks (path primario; non il legacy `X-Gitlab-Token`)

URL tipico della callback:

```text
{PUBLIC_URL}/api/v1/plugins/com.paca.gitlab/projects/{pacaProjectId}/webhook
```

Header attesi: `X-Gitlab-Event`, `webhook-id`, `webhook-timestamp`, `webhook-signature`.

GitLab deve poter raggiungere `PUBLIC_URL` (HTTPS in produzione). Senza `PUBLIC_URL` il link del progetto fallisce.

### 6. Verifica

- In Admin → Plugins: `com.paca.gitlab` version `0.5.0`, enabled.
- Tab GitLab del progetto: token connesso, repo collegato, nessun errore webhook.
- Su un task: crea/linka un branch o una MR; oppure pusha su un branch già linkato e controlla che il webhook arrivi (HTTP 2xx nei log GitLab / API).

---

## Troubleshooting

| Sintomo | Cosa controllare |
|---------|------------------|
| `PLUGIN_INCOMPATIBLE_HOST_VERSION` | Aggiorna Paca a ≥ `minCoreVersion` (`v0.13.3`). |
| Install API 401/403 | API key valida, non revocata, con diritti admin; header `X-API-Key`. |
| Install API 500 su migrations/load | File nei volume: `/plugins/com.paca.gitlab/backend.wasm` e `migrations/*.sql` presenti; log `api`. |
| Link repo fallisce / webhook non creato | `PUBLIC_URL` HTTPS raggiungibile da GitLab; ruolo Maintainer/Owner; token con scope `api`. |
| Token “non funziona” dopo restore DB | `ENCRYPTION_KEY` diversa da quella usata per cifrare i secret → reinseri i token. |
| Lista progetti GitLab vuota/corta | Project/Group token: scope limitato — comportamento atteso. |
| UI plugin non carica | `remoteEntry.js` sotto `/plugins/com.paca.gitlab/assets/`; riavvia `gateway`; hard-refresh browser. |
| Self-Managed: errori outbound | Hostname non in `allowedOutboundDomains` del manifest installato. |
| Firma webhook fallita | GitLab **&lt; 19** o hook creato a mano senza `signing_token`; rilinkare il repo dal plugin. |

---

## Sviluppo locale

Per build + install su stack **dev** (compose locale), usa lo script ufficiale Paca — richiede clone del monorepo Paca, TinyGo/Bun, e API key:

```bash
# vedi anche: https://github.com/Paca-AI/paca/blob/master/scripts/install-local-plugin.sh
./scripts/install-local-plugin.sh /path/to/paca-plugin-gitlab \
  --paca-dir /path/to/paca \
  --api-url http://localhost:3000 \
  --api-key "$API_KEY"
```

Build isolata (senza install):

```bash
cd backend && go test ./... && tinygo build -target=wasip1 -buildmode=c-shared -o gitlab.wasm .
cd frontend && bun install && bun run typecheck && bun run build
cd mcp && bun install && bun run typecheck && bun run build
```

Release: tag `v*` → workflow [`.github/workflows/release.yml`](.github/workflows/release.yml) pubblica i `.tar.gz` + `checksums.txt`.

---

## Cosa fa (riepilogo)

- Salva access token GitLab (cifrato) per progetto Paca
- Elenca/collega progetti GitLab; crea webhook (push, MR, pipeline)
- Su ogni task: branch, merge request, commenti, review, stato pipeline
- Automazioni `gitlab.mr_*`, `gitlab.branch_linked`, …
- Bundle MCP + skill `paca-gitlab-workflow` (task-centrici; non sostituiscono il [MCP ufficiale GitLab](https://docs.gitlab.com/user/model_context_protocol/mcp_server/))

### Differenze vs plugin GitHub

| | GitHub | GitLab (`com.paca.gitlab`) |
|--|--------|----------------------------|
| Oggetto | Pull request | Merge request (`iid`) |
| Auth | PAT | Personal / Project / Group token |
| Host | `api.github.com` | `instance_url` (default `https://gitlab.com`) |
| Webhook | `X-Hub-Signature-256` | `signing_token` HMAC (GitLab 19+) |
| CI | Checks | Pipelines MR |
| UI | en | **en** + **it** |

### Architettura

```text
├── backend/   Go → WASM · schema plugin_data_com_paca_gitlab
├── frontend/  React Module Federation + i18n
├── mcp/       Tool MCP Paca-centrici
├── skills/    paca-gitlab-workflow
└── scripts/   install-from-release.sh (prod)
```

Prefisso API: `/api/v1/plugins/com.paca.gitlab/projects/:projectId/…`  
Permesso custom: `gitlab.manage`.

---

## Note

- Coesistenza GitHub + GitLab sullo stesso progetto Paca: **non** in scope.
- Test smoke Self-Managed: deferred finché non c’è un’istanza da usare; il campo `instance_url` è già nel prodotto.
