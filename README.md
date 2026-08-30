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

## First version conversation

Send any of the following to the OA:

- `AI選床`
- `床面希望較低`
- `房間空間有限`
- `希望四片護欄`
- `售後服務`
- `醫院採購`

The first recommendation rules currently cover representative home-care models such as ES-18UDS, EN-3M, ES-05HDS and ES-12DF. This is a rule-driven MVP; the next phase will add persistent customer intent, product feature data, recommendation history, CRM lead scoring and AI natural-language understanding.
