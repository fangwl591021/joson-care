const LIFF_ID = "2011335134-ccbJ33yx";
const LINE_LOGIN_CHANNEL_ID = "2011335134";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    try {
      if (path === "/health") return json({ ok: true, service: "joson-care", version: "1.0.0" });
      if (path === "/line-webhook") return handleLineWebhook(request, env);
      if (path === "/liff" || path === "/") return html(renderLiffPage(env));
      if (path === "/login") return startLineLogin(request, env);
      if (path === "/callback") return handleLineLoginCallback(request, env);
      if (path === "/api/config") return json({ liffId: env.LIFF_ID || LIFF_ID, lineLoginChannelId: env.LINE_LOGIN_CHANNEL_ID || LINE_LOGIN_CHANNEL_ID });
      return json({ error: "not_found" }, 404);
    } catch (error) {
      console.error(error);
      return json({ error: "internal_error", message: error?.message || "Unknown error" }, 500);
    }
  },
};

async function handleLineWebhook(request, env) {
  if (request.method === "GET") {
    return json({
      ok: true,
      endpoint: "/line-webhook",
      configured: Boolean(env.LINE_CHANNEL_SECRET && env.LINE_CHANNEL_ACCESS_TOKEN),
    });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!env.LINE_CHANNEL_SECRET || !env.LINE_CHANNEL_ACCESS_TOKEN) {
    return json({ error: "line_secrets_not_configured" }, 503);
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature") || "";
  const valid = await verifyLineSignature(rawBody, signature, env.LINE_CHANNEL_SECRET);
  if (!valid) return json({ error: "invalid_signature" }, 401);

  const payload = JSON.parse(rawBody || "{}");
  const events = Array.isArray(payload.events) ? payload.events : [];

  for (const event of events) {
    try {
      if (event.type === "follow" && event.replyToken) {
        await replyLine(event.replyToken, [buildWelcomeMessage()], env.LINE_CHANNEL_ACCESS_TOKEN);
        continue;
      }

      if (event.type === "message" && event.message?.type === "text" && event.replyToken) {
        const messages = routeTextMessage(event.message.text || "");
        await replyLine(event.replyToken, messages, env.LINE_CHANNEL_ACCESS_TOKEN);
      }
    } catch (eventError) {
      console.error("LINE event failed", eventError);
    }
  }

  return json({ ok: true });
}

function routeTextMessage(input) {
  const text = String(input || "").trim();
  const compact = text.replace(/\s+/g, "");

  if (/^(選床|AI選床|智慧選床|幫我選床|開始選床|我要選床)$/i.test(compact)) {
    return [buildNeedQuestion()];
  }

  if (/床面希望較低|床面較低|低床|上下床|怕太高/.test(text)) {
    return [
      productRecommendation(
        "ES-18UDS 超低型電動床",
        ["適合一般居家使用", "最低床面約 23.5cm", "適合重視低床設計的家庭", "木質外觀較符合居家環境"],
        "https://www.joson-care.com/product_d.php?id=30&lang=tw&tb=1",
        ["超低床", "居家照護", "木質外觀"]
      ),
    ];
  }

  if (/折疊|收納|移動|房間小|空間有限/.test(text)) {
    return [
      productRecommendation(
        "EN-3M 折疊型電動照護床",
        ["可折疊", "易收納", "易移動", "適合空間有限的居家環境"],
        "https://www.joson-care.com/product_d.php?id=12&lang=tw&tb=1",
        ["可折疊", "居家使用", "移動收納"]
      ),
    ];
  }

  if (/四片護欄|護欄完整|雙側控制/.test(text)) {
    return [
      productRecommendation(
        "ES-05HDS 旗艦型電動床",
        ["四片式護欄", "雙側操作控制", "適合重視完整防護與操作便利的家庭"],
        "https://www.joson-care.com/product_d.php?id=40&lang=tw&tb=1",
        ["四片護欄", "雙側控制", "居家照護"]
      ),
    ];
  }

  if (/希望較完整操作功能|完整操作|床尾控制|角度顯示|專業操作/.test(text)) {
    return [
      productRecommendation(
        "ES-12DF 尊爵型電動床",
        ["四片護欄", "床尾控制", "角度顯示", "較完整的專業照護功能"],
        "https://www.joson-care.com/product_d.php?id=2&lang=tw&tb=1",
        ["床尾控制", "角度顯示", "四片護欄"]
      ),
    ];
  }

  if (/不知道怎麼選|不確定怎麼選|沒有頭緒/.test(text)) {
    return [buildNeedQuestion("沒關係，不需要先知道型號。目前最希望改善的是哪一件事？")];
  }

  if (/^(我要留下採購需求|請專人聯絡|請專人聯絡我)$/.test(text)) {
    return [
      textMessage("好的，請直接在聊天室留下您的姓名、聯絡電話、所在地區與需求概要，Joson 專責人員即可依資訊接續聯絡。請勿提供病歷或其他不必要的敏感資料。"),
    ];
  }

  if (/^查看醫療床系列$/.test(text)) {
    return [
      {
        type: "template",
        altText: "Joson 醫療床系列",
        template: {
          type: "buttons",
          title: "Joson 醫療床系列",
          text: "院所與機構規格仍需由專責業務依場域與數量評估。",
          actions: [
            { type: "uri", label: "查看醫療床系列", uri: "https://www.joson-care.com/product.php?lang=tw" },
            { type: "message", label: "聯絡專人", text: "請專人聯絡" },
          ],
        },
      },
    ];
  }

  if (/醫院|院所|護理之家|機構|採購|標案/.test(text)) {
    return [
      textMessage(
        "醫療院所與機構採購通常需要依數量、使用場域與規格做專案評估，我可以先幫您整理需求，再由 Joson 專責業務接續。"
      ),
      quickReplyMessage("請選擇下一步：", [
        ["我要留下採購需求", "我要留下採購需求"],
        ["查看醫療床系列", "查看醫療床系列"],
        ["聯絡專人", "請專人聯絡"],
      ]),
    ];
  }

  if (/床型比較|比較其他床型/.test(text)) {
    return [
      quickReplyMessage("四款居家照護床可先依使用需求比較，請選擇目前最在意的條件：", [
        ["床面希望較低", "床面希望較低"],
        ["房間空間有限", "房間空間有限"],
        ["希望四片護欄", "希望四片護欄"],
        ["希望較完整操作功能", "希望較完整操作功能"],
      ]),
    ];
  }

  if (/售後|維修|保固|說明書|故障/.test(text)) {
    return [
      quickReplyMessage("您目前需要哪一類售後協助？", [
        ["保固問題", "保固問題"],
        ["操作說明", "操作說明"],
        ["維修服務", "維修服務"],
        ["查看官網", "查看官網"],
      ]),
    ];
  }

  if (/價格|多少錢|報價|詢價|哪裡看|展示|現貨|送貨|購買/.test(text)) {
    return [
      textMessage(
        "您已經進入實際比較／購買階段。價格、展示、現貨與配送會依型號與地區確認，建議由 Joson-Care 專人依您剛才的需求接續服務。"
      ),
      quickReplyMessage("接下來要怎麼進行？", [
        ["繼續選床", "AI選床"],
        ["請專人聯絡", "請專人聯絡我"],
        ["看官方產品", "居家照護床"],
      ]),
    ];
  }

  if (/居家照護床|產品總覽|看產品|官方產品/.test(text)) {
    return [
      {
        type: "template",
        altText: "Joson-Care 居家照護床",
        template: {
          type: "buttons",
          title: "Joson-Care 居家照護床",
          text: "先看產品也可以；如果不知道怎麼選，建議讓 AI 先問 3～5 個生活情境問題。",
          actions: [
            { type: "uri", label: "官方居家照護床", uri: "https://www.joson-care.com/product.php?lang=tw&tb=1" },
            { type: "message", label: "AI 幫我選床", text: "AI選床" },
          ],
        },
      },
    ];
  }

  return [
    quickReplyMessage(
      "我是 Joson 智慧照護顧問第一版。您可以直接描述家裡遇到的情況，例如「床太高」、「房間小」、「希望護欄完整」，我會先幫您縮小選擇範圍。",
      [
        ["AI 幫我選床", "AI選床"],
        ["床面希望較低", "床面希望較低"],
        ["房間空間有限", "房間空間有限"],
        ["希望四片護欄", "希望四片護欄"],
      ]
    ),
  ];
}

function buildWelcomeMessage() {
  return quickReplyMessage(
    "您好，我是 Joson 智慧照護顧問。\n如果您不知道該怎麼挑電動照護床，我可以從使用情境開始幫您縮小範圍，不需要先知道型號。",
    [
      ["AI 幫我選床", "AI選床"],
      ["居家照護床", "居家照護床"],
      ["床型比較", "床型比較"],
      ["售後服務", "售後服務"],
      ["醫院／機構採購", "醫院／機構採購"],
    ]
  );
}

function buildNeedQuestion(prompt = "目前最希望改善的是哪一件事？") {
  return quickReplyMessage(
    prompt,
    [
      ["床面希望較低", "床面希望較低"],
      ["房間空間有限", "房間空間有限"],
      ["希望四片護欄", "希望四片護欄"],
      ["希望較完整操作功能", "希望較完整操作功能"],
      ["我不知道怎麼選", "我不知道怎麼選"],
    ]
  );
}

function productRecommendation(title, reasons, url, tags) {
  return {
    type: "flex",
    altText: `AI 推薦：${title}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "AI 初步推薦", size: "sm", weight: "bold", color: "#1B6B55" },
          { type: "text", text: title, size: "xl", weight: "bold", wrap: true },
          { type: "text", text: "依您提供的使用需求，可以優先比較：", size: "sm", color: "#555555", wrap: true },
          {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: reasons.map((reason) => ({
              type: "box",
              layout: "horizontal",
              spacing: "sm",
              contents: [
                { type: "text", text: "•", flex: 0, size: "sm", color: "#1B6B55" },
                { type: "text", text: reason, size: "sm", color: "#555555", wrap: true },
              ],
            })),
          },
          {
            type: "box",
            layout: "horizontal",
            flex: 0,
            spacing: "sm",
            contents: tags.slice(0, 3).map((tag) => ({
              type: "text",
              text: tag,
              size: "xs",
              color: "#1B6B55",
              wrap: true,
            })),
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "button", style: "primary", color: "#1B6B55", action: { type: "uri", label: "查看產品", uri: url } },
          { type: "button", action: { type: "message", label: "比較其他床型", text: "床型比較" } },
          { type: "button", action: { type: "message", label: "請專人聯絡", text: "請專人聯絡" } },
        ],
      },
    },
  };
}

function textMessage(text) {
  return { type: "text", text };
}

function quickReplyMessage(text, pairs) {
  return {
    type: "text",
    text,
    quickReply: {
      items: pairs.slice(0, 13).map(([label, message]) => ({
        type: "action",
        action: { type: "message", label: String(label).slice(0, 20), text: String(message).slice(0, 300) },
      })),
    },
  };
}

async function verifyLineSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = bytesToBase64(new Uint8Array(digest));
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function replyLine(replyToken, messages, accessToken) {
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ replyToken, messages: messages.slice(0, 5) }),
  });
  if (!response.ok) throw new Error(`LINE reply failed: ${response.status} ${await response.text()}`);
}

function startLineLogin(request, env) {
  const url = new URL(request.url);
  const channelId = env.LINE_LOGIN_CHANNEL_ID || LINE_LOGIN_CHANNEL_ID;
  const callback = `${url.origin}/callback`;
  const state = crypto.randomUUID();
  const auth = new URL("https://access.line.me/oauth2/v2.1/authorize");
  auth.searchParams.set("response_type", "code");
  auth.searchParams.set("client_id", channelId);
  auth.searchParams.set("redirect_uri", callback);
  auth.searchParams.set("state", state);
  auth.searchParams.set("scope", "openid profile");
  auth.searchParams.set("bot_prompt", "aggressive");

  return new Response(null, {
    status: 302,
    headers: {
      location: auth.toString(),
      "set-cookie": `joson_line_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}

async function handleLineLoginCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return html(simplePage("LINE 登入未完成", `LINE 回傳：${escapeHtml(error)}`), 400);
  if (!code || !state) return html(simplePage("Callback URL 已啟用", "這個端點已可作為 LINE Login Callback URL。"));

  const cookieState = readCookie(request.headers.get("cookie") || "", "joson_line_state");
  if (!cookieState || cookieState !== state) return html(simplePage("登入驗證失敗", "state 驗證失敗，請重新從登入入口開始。"), 400);

  if (!env.LINE_LOGIN_CHANNEL_SECRET) {
    return html(simplePage("Callback 已收到 LINE 回傳", "尚未設定 LINE_LOGIN_CHANNEL_SECRET，因此目前不交換 access token。請先在 Cloudflare Worker Secret 設定後再測試。"), 503);
  }

  const redirectUri = `${url.origin}/callback`;
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: env.LINE_LOGIN_CHANNEL_ID || LINE_LOGIN_CHANNEL_ID,
    client_secret: env.LINE_LOGIN_CHANNEL_SECRET,
  });

  const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });

  if (!tokenResponse.ok) {
    return html(simplePage("LINE 登入交換失敗", `HTTP ${tokenResponse.status}`), 502);
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: "/liff?login=success",
      "set-cookie": "joson_line_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
}

function renderLiffPage(env) {
  const liffId = env.LIFF_ID || LIFF_ID;
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#143c36">
  <title>Joson 智慧照護顧問</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f4f7f6;color:#17332e;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif}.wrap{max-width:720px;margin:auto;padding:24px 18px 48px}.hero{padding:28px 22px;border-radius:22px;background:#163f37;color:white}.eyebrow{font-size:12px;letter-spacing:.14em;opacity:.8}.hero h1{margin:8px 0 10px;font-size:30px;line-height:1.2}.hero p{margin:0;line-height:1.7;opacity:.9}.card{margin-top:16px;padding:18px;border:1px solid #dfe8e5;border-radius:18px;background:#fff}.card h2{margin:0 0 8px;font-size:18px}.card p{margin:0 0 14px;color:#58706a;line-height:1.65}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.btn{min-height:52px;border:0;border-radius:12px;padding:12px;background:#eaf3f0;color:#174f43;font-size:15px;font-weight:800}.btn:disabled{opacity:.5}.status{margin-top:12px;padding:12px;border-radius:12px;background:#eef4f2;color:#45645d;font-size:13px;line-height:1.55}.note{margin-top:16px;color:#71837f;font-size:12px;line-height:1.7}@media(max-width:420px){.grid{grid-template-columns:1fr}.hero h1{font-size:26px}}
  </style>
  <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
</head>
<body>
  <main class="wrap">
    <section class="hero">
      <div class="eyebrow">JOSON AI CARE ADVISOR</div>
      <h1>Joson 智慧照護顧問</h1>
      <p>不知道怎麼選照護床？<br>告訴我們您的使用需求，幫您快速找到適合的方向。</p>
    </section>
    <section class="card">
      <h2>從生活需求開始</h2>
      <p>不用先記型號。點一個最接近的情況，回到 LINE 後我會接著協助。</p>
      <div class="grid">
        <button class="btn" data-message="床面希望較低">床面希望較低</button>
        <button class="btn" data-message="房間空間有限">房間空間有限</button>
        <button class="btn" data-message="希望四片護欄">希望四片護欄</button>
        <button class="btn" data-message="希望較完整操作功能">希望較完整操作功能</button>
      </div>
      <div id="status" class="status">正在連接 LINE…</div>
    </section>
    <section class="card">
      <h2>第一版服務範圍</h2>
      <p>目前先聚焦一般家庭的居家照護床選型；醫療院所與大量採購會轉由專人接手。</p>
    </section>
    <div class="note">本服務提供產品資訊與選型協助，不進行疾病診斷，也不取代醫師、護理師或其他醫療專業人員的判斷。</div>
  </main>
<script>
(async()=>{
  const status=document.getElementById('status');
  const buttons=[...document.querySelectorAll('[data-message]')];
  try{
    await liff.init({liffId:${JSON.stringify(liffId)}});
    const inClient=liff.isInClient();
    const logged=liff.isLoggedIn();
    status.textContent=inClient?'已連接 LINE，可直接開始。':(logged?'已登入 LINE。建議從官方帳號聊天室開啟此頁。':'請從 LINE 官方帳號開啟此頁，或先登入 LINE。');
    buttons.forEach(btn=>btn.addEventListener('click',async()=>{
      const message=btn.dataset.message;
      try{
        if(!liff.isLoggedIn()){liff.login();return;}
        if(liff.isInClient()){
          await liff.sendMessages([{type:'text',text:message}]);
          status.textContent='已送出，正在回到對話。';
          setTimeout(()=>liff.closeWindow(),350);
        }else{
          status.textContent='請從 Joson-Care LINE 官方帳號聊天室內開啟此頁，即可直接送出選床需求。';
        }
      }catch(e){status.textContent='送出失敗：'+(e.message||e);}
    }));
  }catch(e){status.textContent='LIFF 初始化失敗：'+(e.message||e);}
})();
</script>
</body>
</html>`;
}

function simplePage(title, message) {
  return `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><body style="font-family:system-ui;padding:32px;max-width:680px;margin:auto"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p><a href="/liff">回到 Joson 智慧照護顧問</a></p></body></html>`;
}

function readCookie(cookieHeader, name) {
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(";")) {
    const item = part.trim();
    if (item.startsWith(prefix)) return item.slice(prefix.length);
  }
  return "";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function json(data, status = 200) {
  return cors(new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  }));
}

function html(body, status = 200) {
  return cors(new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  }));
}

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "content-type,x-line-signature");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
