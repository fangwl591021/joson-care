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
- `GET /api/admin/summary` — protected CRM summary API
- `GET /api/admin/contacts` — protected LINE contact list
- `GET /api/admin/rich-menu/definition` — protected Rich Menu draft definition

## CRM and Admin

CRM data is stored in the `joson-care-crm` D1 database through the `CRM_DB` binding. LINE webhook replies remain on the critical path; contact, message, intent, recommendation and lead records are written with `ctx.waitUntil()` after the reply attempt.

Run migrations locally before development and remotely only after reviewing the pending list:

```powershell
npx wrangler d1 migrations list joson-care-crm --remote
npx wrangler d1 migrations apply joson-care-crm --remote
```

`/admin` stays unavailable until `ADMIN_ACCESS_KEY` is configured as a Worker Secret. The initial Rich Menu definition is a protected draft only; publishing or replacing the LINE default menu is a separate verified operation.

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
