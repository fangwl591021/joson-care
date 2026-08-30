const ADMIN_COOKIE = "joson_admin_session";
const ADMIN_SESSION_SECONDS = 8 * 60 * 60;

const INTENT_RULES = [
  { pattern: /床面希望較低|床面較低|低床|上下床|怕太高/, intent: "low_bed", tagId: "tag_low_bed", productModel: "ES-18UDS", stage: "selecting" },
  { pattern: /折疊|收納|移動|房間小|空間有限/, intent: "space_saving", tagId: "tag_space_saving", productModel: "EN-3M", stage: "selecting" },
  { pattern: /四片護欄|護欄完整|雙側控制/, intent: "four_rail", tagId: "tag_four_rail", productModel: "ES-05HDS", stage: "selecting" },
  { pattern: /完整操作|床尾控制|角度顯示|專業操作/, intent: "professional_controls", tagId: "tag_professional", productModel: "ES-12DF", stage: "selecting" },
  { pattern: /我要留下採購需求|請專人聯絡|聯絡我/, intent: "contact_request", tagId: "tag_contact_request", stage: "lead", createLead: true },
  { pattern: /醫院|院所|護理之家|機構|採購|標案/, intent: "procurement", tagId: "tag_procurement", stage: "lead" },
  { pattern: /售後|維修|保固|說明書|故障/, intent: "after_sales", tagId: "tag_after_sales", stage: "after_sales" },
  { pattern: /AI選床|智慧選床|幫我選床|開始選床|我要選床/, intent: "start_advisor", stage: "selecting" },
  { pattern: /床型比較|比較其他床型/, intent: "compare_products", stage: "selecting" },
  { pattern: /居家照護床|產品總覽|看產品|官方產品/, intent: "browse_products", stage: "selecting" },
];

export const DEFAULT_RICH_MENU = Object.freeze({
  name: "Joson 智慧照護選單 v1",
  chatBarText: "Joson 智慧服務",
  selected: true,
  size: { width: 2500, height: 1686 },
  areas: [
    richMenuArea(0, 0, 833, 843, "AI 幫我選床", "ai_select"),
    richMenuArea(833, 0, 834, 843, "四款推薦", "featured_products"),
    richMenuArea(1667, 0, 833, 843, "全部產品", "all_products"),
    richMenuArea(0, 843, 833, 843, "床型比較", "compare"),
    richMenuArea(833, 843, 834, 843, "售後服務", "after_sales"),
    richMenuArea(1667, 843, 833, 843, "聯絡專人", "contact"),
  ],
});

function richMenuArea(x, y, width, height, label, action) {
  return {
    bounds: { x, y, width, height },
    action: {
      type: "postback",
      label,
      data: `action=${action}&source=rich_menu_default`,
      displayText: label,
    },
  };
}

export function postbackToText(data) {
  const params = new URLSearchParams(String(data || ""));
  const actions = {
    ai_select: "AI選床",
    featured_products: "居家照護床",
    all_products: "產品總覽",
    compare: "床型比較",
    after_sales: "售後服務",
    contact: "請專人聯絡",
  };
  return actions[params.get("action")] || "AI選床";
}

export async function recordLineInteraction(env, event, inputText, replyMessages) {
  if (!env.CRM_DB) return;
  const lineUserId = String(event?.source?.userId || "").trim();
  if (!lineUserId) return;

  const now = new Date().toISOString();
  const occurredAt = event?.timestamp ? new Date(event.timestamp).toISOString() : now;
  const contactId = `contact_${(await sha256Hex(lineUserId)).slice(0, 24)}`;
  const threadId = `thread_${contactId.slice("contact_".length)}`;
  const eventKey = String(event.webhookEventId || `event_${(await sha256Hex(JSON.stringify({ lineUserId, type: event.type, timestamp: event.timestamp, inputText }))).slice(0, 32)}`);
  const classification = classifyIntent(inputText);
  const friendStatus = event.type === "unfollow" ? "blocked" : "active";
  const preview = String(inputText || event.type || "互動").slice(0, 160);
  const source = event.type === "postback" ? "rich_menu" : "line";
  const metadata = JSON.stringify({
    sourceType: event?.source?.type || null,
    messageType: event?.message?.type || null,
    deliveryContext: event?.deliveryContext?.isRedelivery ? "redelivery" : "initial",
  });

  await env.CRM_DB.prepare(`INSERT INTO crm_contacts
      (id, line_user_id, friend_status, lifecycle_stage, first_seen_at, last_seen_at, last_message_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(line_user_id) DO UPDATE SET
        friend_status = excluded.friend_status,
        lifecycle_stage = CASE
          WHEN crm_contacts.lifecycle_stage = 'customer' THEN crm_contacts.lifecycle_stage
          WHEN crm_contacts.lifecycle_stage = 'lead' AND excluded.lifecycle_stage IN ('new', 'selecting') THEN crm_contacts.lifecycle_stage
          WHEN excluded.lifecycle_stage = 'new' THEN crm_contacts.lifecycle_stage
          ELSE excluded.lifecycle_stage
        END,
        last_seen_at = excluded.last_seen_at,
        last_message_at = COALESCE(excluded.last_message_at, crm_contacts.last_message_at),
        updated_at = excluded.updated_at`)
      .bind(contactId, lineUserId, friendStatus, classification.stage, occurredAt, occurredAt, inputText ? occurredAt : null, now, now)
      .run();

  const eventId = `evt_${(await sha256Hex(eventKey)).slice(0, 24)}`;
  const insertedEvent = await env.CRM_DB.prepare(`INSERT OR IGNORE INTO crm_events
      (id, event_key, contact_id, event_type, source, intent, product_model, metadata_json, occurred_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id`)
      .bind(eventId, eventKey, contactId, event.type || "unknown", source, classification.intent || null, classification.productModel || null, metadata, occurredAt, now)
      .first();
  if (!insertedEvent) return;

  const statements = [
    env.CRM_DB.prepare(`INSERT INTO crm_threads
      (id, contact_id, status, unread_count, last_message_preview, last_message_at, created_at, updated_at)
      VALUES (?, ?, 'open', ?, ?, ?, ?, ?)
      ON CONFLICT(contact_id) DO UPDATE SET
        status = 'open',
        unread_count = crm_threads.unread_count + excluded.unread_count,
        last_message_preview = excluded.last_message_preview,
        last_message_at = excluded.last_message_at,
        updated_at = excluded.updated_at`)
      .bind(threadId, contactId, inputText ? 1 : 0, preview, occurredAt, now, now),
  ];

  if (inputText) {
    statements.push(
      env.CRM_DB.prepare(`INSERT OR IGNORE INTO crm_messages
        (id, thread_id, contact_id, line_event_id, direction, message_type, text_content, sent_at, created_at)
        VALUES (?, ?, ?, ?, 'inbound', ?, ?, ?, ?)`)
        .bind(`msg_in_${(await sha256Hex(eventKey)).slice(0, 24)}`, threadId, contactId, eventKey, event?.message?.type || event.type || "text", String(inputText).slice(0, 2000), occurredAt, now)
    );
  }

  const replySummary = summarizeMessages(replyMessages);
  if (replySummary) {
    statements.push(
      env.CRM_DB.prepare(`INSERT OR IGNORE INTO crm_messages
        (id, thread_id, contact_id, direction, message_type, text_content, payload_summary, sent_at, created_at)
        VALUES (?, ?, ?, 'outbound', 'reply', ?, ?, ?, ?)`)
        .bind(`msg_out_${(await sha256Hex(eventKey)).slice(0, 24)}`, threadId, contactId, replySummary.slice(0, 2000), JSON.stringify({ count: replyMessages.length }), now, now)
    );
  }

  if (classification.tagId) {
    statements.push(
      env.CRM_DB.prepare(`INSERT OR IGNORE INTO crm_contact_tags (contact_id, tag_id, assigned_at) VALUES (?, ?, ?)`)
        .bind(contactId, classification.tagId, now)
    );
  }

  if (classification.createLead) {
    statements.push(
      env.CRM_DB.prepare(`INSERT OR IGNORE INTO crm_leads
        (id, contact_id, status, source, need_summary, recommended_model, created_at, updated_at)
        VALUES (?, ?, 'new', ?, ?, ?, ?, ?)`)
        .bind(`lead_${(await sha256Hex(eventKey)).slice(0, 24)}`, contactId, source, preview, classification.productModel || null, now, now)
    );
  }

  try {
    await env.CRM_DB.batch(statements);
  } catch (error) {
    await env.CRM_DB.prepare("DELETE FROM crm_events WHERE event_key = ?").bind(eventKey).run().catch(() => undefined);
    throw error;
  }

  await updateMissingLineProfile(env, contactId, lineUserId, event.type);
}

async function updateMissingLineProfile(env, contactId, lineUserId, eventType) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN || eventType === "unfollow") return;
  const existing = await env.CRM_DB.prepare("SELECT display_name FROM crm_contacts WHERE id = ?").bind(contactId).first();
  if (existing?.display_name) return;
  try {
    const response = await fetch(`https://api.line.me/v2/bot/profile/${encodeURIComponent(lineUserId)}`, {
      headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    if (!response.ok) return;
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 65536) return;
    const profile = await response.json();
    const displayName = String(profile?.displayName || "").trim().slice(0, 120);
    const pictureUrl = String(profile?.pictureUrl || "").trim().slice(0, 1000);
    if (!displayName) return;
    await env.CRM_DB.prepare("UPDATE crm_contacts SET display_name = ?, picture_url = ?, updated_at = ? WHERE id = ?")
      .bind(displayName, pictureUrl || null, new Date().toISOString(), contactId)
      .run();
  } catch (error) {
    console.warn(JSON.stringify({ level: "warn", message: "LINE profile refresh skipped", error: error?.message || String(error) }));
  }
}

function classifyIntent(input) {
  const text = String(input || "");
  const matched = INTENT_RULES.find((rule) => rule.pattern.test(text));
  return matched || { intent: eventIntentFallback(text), tagId: null, productModel: null, stage: "new", createLead: false };
}

function eventIntentFallback(text) {
  return text ? "general_message" : "line_event";
}

function summarizeMessages(messages) {
  return (Array.isArray(messages) ? messages : []).map((message) => {
    if (message?.type === "text") return message.text;
    if (message?.type === "flex") return message.altText;
    if (message?.type === "template") return message.altText;
    return message?.type || "reply";
  }).filter(Boolean).join("｜");
}

export async function handleAdminRequest(request, env, url) {
  const path = url.pathname;
  if (!env.CRM_DB) return adminJson({ error: "crm_not_configured" }, 503);

  if (path === "/admin/login") {
    if (request.method === "GET") return adminHtml(renderLoginPage(Boolean(env.ADMIN_ACCESS_KEY)));
    if (request.method !== "POST") return adminJson({ error: "method_not_allowed" }, 405);
    if (!env.ADMIN_ACCESS_KEY) return adminHtml(renderSetupRequired(), 503);
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 10000) return adminJson({ error: "payload_too_large" }, 413);
    const form = await request.formData();
    const key = String(form.get("accessKey") || "");
    if (!timingSafeTextEqual(key, env.ADMIN_ACCESS_KEY)) return adminHtml(renderLoginPage(true, "存取碼錯誤。"), 401);
    const session = await createAdminSession(env.ADMIN_ACCESS_KEY);
    return new Response(null, { status: 302, headers: { location: "/admin", "set-cookie": `${ADMIN_COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${ADMIN_SESSION_SECONDS}` } });
  }

  if (path === "/admin/logout" && request.method === "POST") {
    return new Response(null, { status: 302, headers: { location: "/admin/login", "set-cookie": `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` } });
  }

  if (!env.ADMIN_ACCESS_KEY) {
    if (path.startsWith("/api/admin/")) return adminJson({ error: "admin_not_configured" }, 503);
    return adminHtml(renderSetupRequired(), 503);
  }
  if (!(await isAdminAuthorized(request, env.ADMIN_ACCESS_KEY))) {
    if (path.startsWith("/api/admin/")) return adminJson({ error: "unauthorized" }, 401);
    return new Response(null, { status: 302, headers: { location: "/admin/login" } });
  }

  if (path === "/admin" && request.method === "GET") return adminHtml(renderAdminPage());
  if (path === "/api/admin/summary" && request.method === "GET") return getAdminSummary(env.CRM_DB);
  if (path === "/api/admin/contacts" && request.method === "GET") return getAdminContacts(env.CRM_DB, url);
  if (path === "/api/admin/rich-menu/definition" && request.method === "GET") return adminJson({ ok: true, status: "draft", definition: DEFAULT_RICH_MENU });

  const detailMatch = path.match(/^\/api\/admin\/contacts\/([^/]+)$/);
  if (detailMatch && request.method === "GET") return getAdminContact(env.CRM_DB, decodeURIComponent(detailMatch[1]));

  const noteMatch = path.match(/^\/api\/admin\/contacts\/([^/]+)\/notes$/);
  if (noteMatch && request.method === "POST") return createAdminNote(request, env.CRM_DB, decodeURIComponent(noteMatch[1]));

  return adminJson({ error: "not_found" }, 404);
}

async function getAdminSummary(db) {
  const results = await db.batch([
    db.prepare("SELECT COUNT(*) AS count FROM crm_contacts"),
    db.prepare("SELECT COUNT(*) AS count FROM crm_contacts WHERE last_seen_at >= datetime('now', '-7 days')"),
    db.prepare("SELECT COUNT(*) AS count FROM crm_leads WHERE status NOT IN ('won', 'lost')"),
    db.prepare("SELECT COUNT(*) AS count FROM crm_threads WHERE unread_count > 0"),
  ]);
  return adminJson({
    ok: true,
    contacts: numberFromResult(results[0]),
    active7d: numberFromResult(results[1]),
    openLeads: numberFromResult(results[2]),
    unreadThreads: numberFromResult(results[3]),
  });
}

async function getAdminContacts(db, url) {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 100);
  const stage = String(url.searchParams.get("stage") || "").trim();
  const query = String(url.searchParams.get("q") || "").trim();
  const conditions = [];
  const values = [];
  if (stage) { conditions.push("c.lifecycle_stage = ?"); values.push(stage); }
  if (query) { conditions.push("(c.line_user_id LIKE ? OR c.display_name LIKE ? OR t.last_message_preview LIKE ?)"); const needle = `%${query}%`; values.push(needle, needle, needle); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const statement = db.prepare(`SELECT c.id, c.line_user_id, c.display_name, c.friend_status, c.lifecycle_stage,
    c.first_seen_at, c.last_seen_at, t.unread_count, t.last_message_preview, t.last_message_at,
    (SELECT GROUP_CONCAT(tag.name, ', ') FROM crm_contact_tags ct JOIN crm_tags tag ON tag.id = ct.tag_id WHERE ct.contact_id = c.id) AS tags
    FROM crm_contacts c LEFT JOIN crm_threads t ON t.contact_id = c.id
    ${where} ORDER BY COALESCE(t.last_message_at, c.last_seen_at) DESC LIMIT ?`).bind(...values, limit);
  const result = await statement.all();
  return adminJson({ ok: true, contacts: result.results || [] });
}

async function getAdminContact(db, id) {
  const results = await db.batch([
    db.prepare("SELECT * FROM crm_contacts WHERE id = ?").bind(id),
    db.prepare("SELECT * FROM crm_messages WHERE contact_id = ? ORDER BY sent_at DESC LIMIT 100").bind(id),
    db.prepare("SELECT * FROM crm_events WHERE contact_id = ? ORDER BY occurred_at DESC LIMIT 100").bind(id),
    db.prepare("SELECT * FROM crm_leads WHERE contact_id = ? ORDER BY updated_at DESC").bind(id),
    db.prepare("SELECT n.* FROM crm_notes n WHERE n.contact_id = ? ORDER BY n.created_at DESC").bind(id),
  ]);
  const contact = results[0].results?.[0];
  if (!contact) return adminJson({ error: "contact_not_found" }, 404);
  return adminJson({ ok: true, contact, messages: results[1].results || [], events: results[2].results || [], leads: results[3].results || [], notes: results[4].results || [] });
}

async function createAdminNote(request, db, contactId) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 10000) return adminJson({ error: "payload_too_large" }, 413);
  const payload = await request.json().catch(() => ({}));
  const note = String(payload.note || "").trim().slice(0, 2000);
  if (!note) return adminJson({ error: "note_required" }, 400);
  const exists = await db.prepare("SELECT id FROM crm_contacts WHERE id = ?").bind(contactId).first();
  if (!exists) return adminJson({ error: "contact_not_found" }, 404);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare("INSERT INTO crm_notes (id, contact_id, author, note, created_at) VALUES (?, ?, 'admin', ?, ?)").bind(id, contactId, note, now),
    db.prepare("INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, detail_json, created_at) VALUES (?, 'admin', 'note.create', 'contact', ?, ?, ?)").bind(crypto.randomUUID(), contactId, JSON.stringify({ noteId: id }), now),
  ]);
  return adminJson({ ok: true, id }, 201);
}

function numberFromResult(result) {
  return Number(result?.results?.[0]?.count || 0);
}

async function isAdminAuthorized(request, secret) {
  const authorization = request.headers.get("authorization") || "";
  if (authorization.startsWith("Bearer ") && timingSafeTextEqual(authorization.slice(7), secret)) return true;
  const session = readCookie(request.headers.get("cookie") || "", ADMIN_COOKIE);
  return verifyAdminSession(session, secret);
}

async function createAdminSession(secret) {
  const issuedAt = Math.floor(Date.now() / 1000);
  return `${issuedAt}.${await hmacBase64Url(String(issuedAt), secret)}`;
}

async function verifyAdminSession(session, secret) {
  const [issuedAtRaw, signature] = String(session || "").split(".");
  const issuedAt = Number(issuedAtRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(issuedAt) || issuedAt > now + 60 || now - issuedAt > ADMIN_SESSION_SECONDS) return false;
  const expected = await hmacBase64Url(issuedAtRaw, secret);
  return timingSafeTextEqual(signature || "", expected);
}

async function hmacBase64Url(value, secret) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeTextEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

function readCookie(header, name) {
  const prefix = `${name}=`;
  for (const part of String(header || "").split(";")) {
    const item = part.trim();
    if (item.startsWith(prefix)) return item.slice(prefix.length);
  }
  return "";
}

function renderLoginPage(configured, error = "") {
  if (!configured) return renderSetupRequired();
  return page("Admin 登入", `<main class="login"><div class="panel"><div class="eyebrow">JOSON CRM</div><h1>管理後台登入</h1><p>請輸入 Cloudflare Worker Secret 中設定的管理存取碼。</p>${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}<form method="post" action="/admin/login"><label>管理存取碼<input name="accessKey" type="password" autocomplete="current-password" required></label><button type="submit">登入 CRM</button></form></div></main>`);
}

function renderSetupRequired() {
  return page("Admin 尚未啟用", `<main class="login"><div class="panel"><div class="eyebrow">JOSON CRM</div><h1>Admin 尚未啟用</h1><p>CRM 已建立，但必須先設定 <code>ADMIN_ACCESS_KEY</code> Worker Secret 才能登入，會員資料不會公開。</p></div></main>`);
}

function renderAdminPage() {
  const menuTiles = ["AI 幫我選床", "四款推薦", "全部產品", "床型比較", "售後服務", "聯絡專人"].map((label) => `<div>${label}</div>`).join("");
  return page("Joson CRM", `<header><div><div class="eyebrow">JOSON CARE OPERATIONS</div><h1>CRM 與智能圖文選單</h1></div><form method="post" action="/admin/logout"><button class="secondary">登出</button></form></header><main><section class="stats" id="stats"><div class="stat">載入中…</div></section><section class="layout"><div class="panel"><div class="section-title"><h2>最近會員</h2><button class="secondary" onclick="loadContacts()">重新整理</button></div><div class="table-wrap"><table><thead><tr><th>會員</th><th>階段</th><th>標籤</th><th>最後訊息</th><th>時間</th></tr></thead><tbody id="contacts"><tr><td colspan="5">載入中…</td></tr></tbody></table></div></div><aside class="panel"><div class="eyebrow">RICH MENU DRAFT</div><h2>第一版六宮格</h2><div class="menu-preview">${menuTiles}</div><p class="muted">目前只建立草稿定義，尚未發布或替換 LINE 現有選單。</p></aside></section></main><script>
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>v?new Date(v).toLocaleString('zh-TW'):'—';
async function loadSummary(){const r=await fetch('/api/admin/summary');if(r.status===401)return location.href='/admin/login';const d=await r.json();document.getElementById('stats').innerHTML=[['會員總數',d.contacts],['7 日活躍',d.active7d],['進行中商機',d.openLeads],['未讀對話',d.unreadThreads]].map(x=>'<div class="stat"><strong>'+e(x[1])+'</strong><span>'+e(x[0])+'</span></div>').join('')}
async function loadContacts(){const r=await fetch('/api/admin/contacts?limit=50');if(r.status===401)return location.href='/admin/login';const d=await r.json();document.getElementById('contacts').innerHTML=d.contacts.length?d.contacts.map(c=>'<tr><td><code>'+e(c.line_user_id.slice(0,8))+'…</code></td><td><span class="badge">'+e(c.lifecycle_stage)+'</span></td><td>'+e(c.tags||'—')+'</td><td>'+e(c.last_message_preview||'—')+'</td><td>'+e(date(c.last_message_at||c.last_seen_at))+'</td></tr>').join(''):'<tr><td colspan="5">尚無會員互動資料。請先從 LINE 傳送一則訊息。</td></tr>'}
loadSummary();loadContacts();
</script>`);
}

function page(title, body) {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f6f5;color:#17332e;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif}header{display:flex;justify-content:space-between;align-items:center;padding:22px max(20px,calc((100vw - 1180px)/2));background:#153f37;color:#fff}h1,h2{margin:4px 0 12px}.eyebrow{font-size:12px;letter-spacing:.14em;color:#7bbca9;font-weight:800}main{max-width:1180px;margin:auto;padding:24px}.login{max-width:520px;padding-top:10vh}.panel{background:#fff;border:1px solid #dce6e3;border-radius:18px;padding:20px;box-shadow:0 8px 28px rgba(20,63,55,.06)}label{display:grid;gap:8px;font-weight:700}input{width:100%;padding:13px;border:1px solid #bfd1cc;border-radius:10px;font:inherit}button{border:0;border-radius:10px;background:#1b6b55;color:#fff;padding:11px 16px;font-weight:800;cursor:pointer}form{display:grid;gap:14px}.secondary{background:#e5efec;color:#174f43}.error{background:#fff1f1;color:#9b2c2c;padding:10px;border-radius:8px;margin:12px 0}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}.stat{background:#fff;border:1px solid #dce6e3;border-radius:15px;padding:18px}.stat strong{display:block;font-size:30px}.stat span,.muted{color:#657a74}.layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:18px}.section-title{display:flex;justify-content:space-between;align-items:center}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid #e7eeec;vertical-align:top}th{font-size:12px;color:#657a74}.badge{padding:4px 8px;border-radius:999px;background:#e5f1ed;color:#175b49;font-size:12px}.menu-preview{display:grid;grid-template-columns:repeat(3,1fr);aspect-ratio:2500/1686;border:5px solid #163f37;border-radius:12px;overflow:hidden}.menu-preview div{display:grid;place-items:center;text-align:center;padding:8px;background:#eaf3f0;border:1px solid #c9ded8;color:#174f43;font-weight:800}code{font-size:12px}@media(max-width:800px){.stats{grid-template-columns:1fr 1fr}.layout{grid-template-columns:1fr}header{padding:18px}main{padding:16px}}@media(max-width:480px){.stats{grid-template-columns:1fr 1fr}.stat strong{font-size:24px}}</style></head><body>${body}</body></html>`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

function adminJson(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

function adminHtml(body, status = 200) {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" } });
}
