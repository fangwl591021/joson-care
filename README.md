# Joson-Care LINE AI Care Advisor

第一版 LINE OA / LIFF starter，先聚焦一般家庭的居家照護床智慧選型。

## Production URLs

- Worker: `https://joson-care.fangwl591021.workers.dev/`
- LINE Messaging API Webhook URL: `https://joson-care.fangwl591021.workers.dev/line-webhook`
- LINE Login Callback URL: `https://joson-care.fangwl591021.workers.dev/callback`
- LIFF Endpoint URL: `https://joson-care.fangwl591021.workers.dev/liff`
- Health Check: `https://joson-care.fangwl591021.workers.dev/health`

## LINE IDs

- LINE Login Channel ID: `2011335134`
- LIFF ID: `2011335134-ccbJ33yx`

## Required Cloudflare Worker secrets

Do not commit secrets to GitHub.

```powershell
npx wrangler secret put LINE_CHANNEL_SECRET
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
npx wrangler secret put LINE_LOGIN_CHANNEL_SECRET
npx wrangler secret put ADMIN_ACCESS_KEY
```

`LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN` belong to the Messaging API channel.
`LINE_LOGIN_CHANNEL_SECRET` belongs to LINE Login channel `2011335134`.

## First version routes

- `GET /` or `GET /liff` — LIFF smart selection landing page
- `GET|POST /line-webhook` — LINE OA webhook
- `GET /login` — optional LINE Login authorization start
- `GET /callback` — LINE Login callback
- `GET /health` — Worker health endpoint
- `GET /api/config` — non-secret LIFF / LINE Login IDs
- `GET /products` — local Traditional Chinese product catalog
- `GET /products/:slug` — local product detail page
- `GET /api/products` — structured product catalog API (`q` and `featured=1` filters supported)
- `GET /admin` — protected CRM and Rich Menu draft dashboard
- `GET /admin/crm` — CRM and AI chat monitoring workspace
- `GET /admin/products` — Traditional Chinese product catalog workspace
- `GET /admin/rich-menu` — Rich Menu template, project, publish and verification workspace
- `GET /admin/settings` — read-only LINE, LIFF, D1 and secret-presence status
- `GET /admin/chat-monitor` — protected mobile-ready CRM / AI chat monitoring dashboard
- `GET /api/admin/summary` — protected CRM summary API
- `GET /api/admin/contacts` — protected LINE contact list
- `GET /api/admin/chat/insights` — protected unread, priority and intent monitoring summary
- `GET /api/admin/chat/threads` — protected filterable LINE conversation list
- `GET|PATCH /api/admin/chat/threads/:id` — protected conversation timeline and monitor controls
- `POST /api/admin/chat/threads/:id/read` — mark a conversation as reviewed
- `POST /api/admin/chat/threads/:id/notes` — add an internal CRM note
- `GET /api/admin/system/status` — protected non-secret system configuration status
- `GET /api/admin/rich-menu/definition` — protected Rich Menu draft definition
- `GET /api/admin/rich-menu/studio` — protected template, project, editable draft, version and publish-run workspace data
- `GET|POST /api/admin/rich-menu/templates` — list or create reusable Rich Menu templates
- `GET|PATCH|DELETE /api/admin/rich-menu/templates/:id` — inspect, update or archive a template
- `POST /api/admin/rich-menu/projects/from-template` — create an independent project snapshot from a template
- `GET /api/admin/rich-menu/projects/:id` — load one project, its editable definition and switch targets
- `PATCH /api/admin/rich-menu/projects/:id/draft` — validate and save Rich Menu names, tappable bounds and actions without publishing
- `POST /api/admin/rich-menu/projects/:id/upload-image` — validate and store a project PNG/JPEG in R2
- `POST /api/admin/rich-menu/projects/:id/toggle` — enable or disable a non-default project and its Alias
- `POST /api/admin/rich-menu/projects/:id/set-default` — switch an already-published project to the LINE default
- `POST /api/admin/rich-menu/projects/:id/publish` — create, upload, alias, activate and verify a new LINE version

## CRM and Admin

CRM data is stored in the `joson-care-crm` D1 database through the `CRM_DB` binding. LINE webhook replies remain on the critical path; contact, message, intent, recommendation and lead records are written with `ctx.waitUntil()` after the reply attempt.

The AI chat monitor uses the existing deterministic intent rules to classify needs, recommended models and follow-up priority. It does not call an external AI model or consume a separate AI quota. The monitor refreshes every 15 seconds and supports unread, priority, lifecycle and status filters, full inbound/outbound timelines, assignment, review state and private notes.

Run migrations locally before development and remotely only after reviewing the pending list:

```powershell
npx wrangler d1 migrations list joson-care-crm --remote
npx wrangler d1 migrations apply joson-care-crm --remote
```

`/admin` stays unavailable until `ADMIN_ACCESS_KEY` is configured as a Worker Secret. Rich Menu templates, projects, editable drafts, versions and publish runs are stored in D1; uploaded template and project images use the private `RICH_MENU_ASSETS` R2 binding. The Rich Menu Studio mirrors the Smart-Menu-Studio workflow with separate project list, project builder, template center, template editor, project content editor, LINE phone preview, URI/message/postback/page-switch actions, enable/disable controls, default-page switching, publish confirmation and history. Draft saves validate LINE dimensions, bounds, overlap and action fields but never publish automatically. The Joson default project keeps its custom asymmetric layout with a large smart-advisor entry, four real product images and a service rail instead of a stock six-grid template.

Regenerate its deterministic PNG after an intentional visual change:

```powershell
& "C:\Users\User\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" scripts\render-rich-menu.py
```

The Admin publish action validates the definition and page-switch targets, creates a new LINE Rich Menu, uploads the PNG/JPEG, updates its stable alias, sets it as default and verifies the live default before any best-effort cleanup of the prior menu. If Alias or default switching fails, it attempts to restore the previous live state before recording the failed run.

## Local product snapshot

The Worker contains a structured snapshot of the 85 Traditional Chinese product pages listed in the official sitemap. The four first-version home-care recommendations also include locally hosted product images under `public/assets/products/`, so LINE users do not need to wait for the original website.

Refresh the snapshot deliberately after reviewing changes to the official sitemap:

```powershell
node scripts/sync-products.mjs
```

The sync fails closed if the sitemap product count changes from 85, so a catalog expansion or removal must be reviewed before deployment. Original source URLs remain in the snapshot for auditing; LINE recommendations continue to use curated, non-diagnostic wording.

## First version conversation

Send any of the following to the OA:

- `AI選床`
- `床面希望較低`
- `房間空間有限`
- `希望四片護欄`
- `售後服務`
- `醫院採購`

The first recommendation rules currently cover representative home-care models such as ES-18UDS, EN-3M, ES-05HDS and ES-12DF. This is a rule-driven MVP; the next phase will add persistent customer intent, product feature data, recommendation history, CRM lead scoring and AI natural-language understanding.
