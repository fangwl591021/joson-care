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
  name: "Joson 客製智慧照護選單 v1",
  chatBarText: "Joson 智慧服務",
  selected: true,
  size: { width: 2500, height: 1686 },
  areas: [
    richMenuArea(0, 0, 1030, 1686, "智慧選床顧問", "ai_select"),
    richMenuArea(1030, 0, 1470, 970, "四款居家精選", "featured_products"),
    richMenuArea(1030, 970, 383, 716, "全系列產品", "all_products"),
    richMenuArea(1413, 970, 362, 716, "床型比較", "compare"),
    richMenuArea(1775, 970, 363, 716, "售後服務", "after_sales"),
    richMenuArea(2138, 970, 362, 716, "專人諮詢", "contact"),
  ],
});

const RICH_MENU_PROJECT_ID = "joson-care-default";
const RICH_MENU_TEMPLATE_ID = "joson-custom-asymmetric-v1";
const RICH_MENU_ALIAS_ID = "joson-care-default";
const RICH_MENU_IMAGE_PATH = "/assets/rich-menu/joson-care-custom-v1.png";

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
    env.CRM_DB.prepare(`INSERT INTO crm_thread_monitor_state
      (thread_id, priority, last_intent, last_product_model, analysis_mode, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'rule_based', ?, ?)
      ON CONFLICT(thread_id) DO UPDATE SET
        priority = MAX(crm_thread_monitor_state.priority, excluded.priority),
        last_intent = COALESCE(excluded.last_intent, crm_thread_monitor_state.last_intent),
        last_product_model = COALESCE(excluded.last_product_model, crm_thread_monitor_state.last_product_model),
        updated_at = excluded.updated_at`)
      .bind(threadId, monitorPriorityForIntent(classification.intent), classification.intent || null, classification.productModel || null, now, now),
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

export function monitorPriorityForIntent(intent) {
  if (intent === "contact_request" || intent === "procurement") return 3;
  if (intent === "after_sales") return 2;
  if (["low_bed", "space_saving", "four_rail", "professional_controls", "start_advisor", "compare_products", "browse_products"].includes(intent)) return 1;
  return 0;
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
  const publishMatch = path.match(/^\/api\/admin\/rich-menu\/projects\/([^/]+)\/publish$/);
  const chatThreadMatch = path.match(/^\/api\/admin\/chat\/threads\/([^/]+)$/);
  const chatReadMatch = path.match(/^\/api\/admin\/chat\/threads\/([^/]+)\/read$/);
  const chatNoteMatch = path.match(/^\/api\/admin\/chat\/threads\/([^/]+)\/notes$/);
  const maintenanceRoute = (publishMatch && request.method === "POST") || (path === "/api/admin/rich-menu/verify" && request.method === "GET");
  const maintenanceTokenAuthorized = Boolean(
    maintenanceRoute && env.RICH_MENU_PUBLISH_TOKEN && isBearerAuthorized(request, env.RICH_MENU_PUBLISH_TOKEN)
  );
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
  if (!maintenanceTokenAuthorized && !(await isAdminAuthorized(request, env.ADMIN_ACCESS_KEY))) {
    if (path.startsWith("/api/admin/")) return adminJson({ error: "unauthorized" }, 401);
    return new Response(null, { status: 302, headers: { location: "/admin/login" } });
  }

  if (path === "/admin" && request.method === "GET") return adminHtml(renderAdminPage());
  if ((path === "/admin/crm" || path === "/admin/chat-monitor") && request.method === "GET") return adminHtml(renderChatMonitorPage());
  if (path === "/admin/products" && request.method === "GET") return adminHtml(renderAdminProductsPage());
  if (path === "/admin/rich-menu" && request.method === "GET") return adminHtml(renderAdminRichMenuPage());
  if (path === "/admin/settings" && request.method === "GET") return adminHtml(renderAdminSettingsPage());
  if (path === "/api/admin/summary" && request.method === "GET") return getAdminSummary(env.CRM_DB);
  if (path === "/api/admin/contacts" && request.method === "GET") return getAdminContacts(env.CRM_DB, url);
  if (path === "/api/admin/chat/insights" && request.method === "GET") return getChatInsights(env.CRM_DB);
  if (path === "/api/admin/chat/threads" && request.method === "GET") return getChatThreads(env.CRM_DB, url);
  if (path === "/api/admin/system/status" && request.method === "GET") return getAdminSystemStatus(env, url);
  if (chatReadMatch && request.method === "POST") return markChatThreadRead(env.CRM_DB, decodeURIComponent(chatReadMatch[1]));
  if (chatNoteMatch && request.method === "POST") return createChatThreadNote(request, env.CRM_DB, decodeURIComponent(chatNoteMatch[1]));
  if (chatThreadMatch && request.method === "GET") return getChatThread(env.CRM_DB, decodeURIComponent(chatThreadMatch[1]));
  if (chatThreadMatch && request.method === "PATCH") return updateChatThread(request, env.CRM_DB, decodeURIComponent(chatThreadMatch[1]));
  if (path === "/api/admin/rich-menu/definition" && request.method === "GET") return adminJson({ ok: true, imagePath: RICH_MENU_IMAGE_PATH, definition: DEFAULT_RICH_MENU });
  if (path === "/api/admin/rich-menu/templates" && request.method === "GET") return getRichMenuTemplates(env.CRM_DB);
  if (path === "/api/admin/rich-menu/projects" && request.method === "GET") return getRichMenuProjects(env.CRM_DB);
  if (path === "/api/admin/rich-menu/status" && request.method === "GET") return getRichMenuStatus(env);
  if (path === "/api/admin/rich-menu/verify" && request.method === "GET") return verifyRichMenuLive(env, url);
  if (publishMatch && request.method === "POST") return publishRichMenuProject(env, url, decodeURIComponent(publishMatch[1]));

  const detailMatch = path.match(/^\/api\/admin\/contacts\/([^/]+)$/);
  if (detailMatch && request.method === "GET") return getAdminContact(env.CRM_DB, decodeURIComponent(detailMatch[1]));

  const noteMatch = path.match(/^\/api\/admin\/contacts\/([^/]+)\/notes$/);
  if (noteMatch && request.method === "POST") return createAdminNote(request, env.CRM_DB, decodeURIComponent(noteMatch[1]));

  return adminJson({ error: "not_found" }, 404);
}

async function getRichMenuTemplates(db) {
  const result = await db.prepare("SELECT * FROM rich_menu_templates ORDER BY updated_at DESC").all();
  return adminJson({ ok: true, templates: result.results || [] });
}

async function getRichMenuProjects(db) {
  const result = await db.prepare(`SELECT p.*, t.name AS template_name, v.line_rich_menu_id, v.image_path, v.published_at
    FROM rich_menu_projects p
    JOIN rich_menu_templates t ON t.id = p.template_id
    LEFT JOIN rich_menu_versions v ON v.id = p.current_version_id
    ORDER BY p.updated_at DESC`).all();
  return adminJson({ ok: true, projects: result.results || [] });
}

async function getRichMenuStatus(env) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return adminJson({ error: "line_access_token_not_configured" }, 503);
  let current = null;
  let lineError = null;
  try {
    current = await getDefaultRichMenu(env.LINE_CHANNEL_ACCESS_TOKEN);
  } catch (error) {
    lineError = String(error?.message || error).slice(0, 200);
  }
  const project = await env.CRM_DB.prepare(`SELECT p.*, t.name AS template_name, v.line_rich_menu_id, v.published_at
    FROM rich_menu_projects p JOIN rich_menu_templates t ON t.id = p.template_id LEFT JOIN rich_menu_versions v ON v.id = p.current_version_id
    WHERE p.id = ?`).bind(RICH_MENU_PROJECT_ID).first();
  return adminJson({ ok: !lineError, lineDefault: current, project, lineError });
}

async function verifyRichMenuLive(env, url) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN || !env.ASSETS) return adminJson({ error: "rich_menu_verification_not_configured" }, 503);
  const project = await env.CRM_DB.prepare(`SELECT p.status, p.current_version_id, v.line_rich_menu_id, v.definition_json, v.image_path, v.published_at
    FROM rich_menu_projects p LEFT JOIN rich_menu_versions v ON v.id = p.current_version_id WHERE p.id = ?`)
    .bind(RICH_MENU_PROJECT_ID).first();
  if (!project?.line_rich_menu_id) return adminJson({ error: "rich_menu_not_published" }, 409);

  const current = await getDefaultRichMenu(env.LINE_CHANNEL_ACCESS_TOKEN);
  const liveDefinition = await lineApiRequest(`https://api.line.me/v2/bot/richmenu/${encodeURIComponent(project.line_rich_menu_id)}`, env.LINE_CHANNEL_ACCESS_TOKEN, {}, true);
  const lineImageResponse = await fetch(`https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(project.line_rich_menu_id)}/content`, {
    headers: { authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` },
  });
  if (!lineImageResponse.ok) throw new Error(`LINE image verification failed: HTTP ${lineImageResponse.status} ${await readTextLimited(lineImageResponse)}`);
  const lineImage = await lineImageResponse.arrayBuffer();
  if (lineImage.byteLength > 1_000_000) throw new Error(`LINE image verification exceeded size limit: ${lineImage.byteLength}`);
  const assetResponse = await env.ASSETS.fetch(new Request(new URL(project.image_path || RICH_MENU_IMAGE_PATH, url.origin)));
  if (!assetResponse.ok) throw new Error(`Local image verification failed: HTTP ${assetResponse.status}`);
  const localImage = await assetResponse.arrayBuffer();
  const [lineSha256, localSha256] = await Promise.all([sha256ArrayBuffer(lineImage), sha256ArrayBuffer(localImage)]);
  const expectedDefinition = JSON.parse(project.definition_json || "{}");
  const definitionMatch = canonicalJson(normalizeRichMenuDefinition(liveDefinition)) === canonicalJson(normalizeRichMenuDefinition(expectedDefinition));
  return adminJson({
    ok: current.richMenuId === project.line_rich_menu_id && lineSha256 === localSha256 && definitionMatch,
    projectStatus: project.status,
    publishedAt: project.published_at,
    lineDefaultRichMenuId: current.richMenuId,
    expectedRichMenuId: project.line_rich_menu_id,
    defaultMatch: current.richMenuId === project.line_rich_menu_id,
    definitionMatch,
    imageBytes: lineImage.byteLength,
    imageSha256: lineSha256,
    imageShaMatch: lineSha256 === localSha256,
  });
}

function normalizeRichMenuDefinition(value) {
  return {
    size: value?.size,
    selected: value?.selected,
    name: value?.name,
    chatBarText: value?.chatBarText,
    areas: value?.areas,
  };
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256ArrayBuffer(value) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function publishRichMenuProject(env, url, projectId) {
  if (projectId !== RICH_MENU_PROJECT_ID) return adminJson({ error: "project_not_found" }, 404);
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return adminJson({ error: "line_access_token_not_configured" }, 503);
  if (!env.ASSETS) return adminJson({ error: "assets_binding_not_configured" }, 503);

  const project = await env.CRM_DB.prepare("SELECT * FROM rich_menu_projects WHERE id = ?").bind(projectId).first();
  if (!project) return adminJson({ error: "project_not_found" }, 404);

  const now = new Date().toISOString();
  const runId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  let newRichMenuId = null;
  let previousRichMenuId = null;
  const claimed = await env.CRM_DB.prepare("UPDATE rich_menu_projects SET status = 'publishing', updated_at = ? WHERE id = ? AND status <> 'publishing'")
    .bind(now, projectId).run();
  if (Number(claimed?.meta?.changes || 0) !== 1) return adminJson({ error: "publish_already_running" }, 409);

  try {
    await env.CRM_DB.batch([
      env.CRM_DB.prepare(`INSERT INTO rich_menu_versions
        (id, name, audience_stage, alias_id, definition_json, image_path, status, created_at, updated_at)
        VALUES (?, ?, 'default', ?, ?, ?, 'draft', ?, ?)`)
        .bind(versionId, DEFAULT_RICH_MENU.name, RICH_MENU_ALIAS_ID, JSON.stringify(DEFAULT_RICH_MENU), RICH_MENU_IMAGE_PATH, now, now),
      env.CRM_DB.prepare(`INSERT INTO rich_menu_publish_runs
        (id, project_id, version_id, stage, status, started_at)
        VALUES (?, ?, ?, 'prepare', 'running', ?)`)
        .bind(runId, projectId, versionId, now),
    ]);
    const current = await getDefaultRichMenu(env.LINE_CHANNEL_ACCESS_TOKEN);
    previousRichMenuId = current.richMenuId || null;
    await updatePublishRun(env.CRM_DB, runId, "validate", previousRichMenuId, null);
    await lineApiRequest("https://api.line.me/v2/bot/richmenu/validate", env.LINE_CHANNEL_ACCESS_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(DEFAULT_RICH_MENU),
    });

    await updatePublishRun(env.CRM_DB, runId, "create", previousRichMenuId, null);
    const created = await lineApiRequest("https://api.line.me/v2/bot/richmenu", env.LINE_CHANNEL_ACCESS_TOKEN, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(DEFAULT_RICH_MENU),
    }, true);
    newRichMenuId = String(created.richMenuId || "");
    if (!newRichMenuId) throw new Error("LINE did not return a Rich Menu ID");

    await updatePublishRun(env.CRM_DB, runId, "upload", previousRichMenuId, newRichMenuId);
    const assetUrl = new URL(RICH_MENU_IMAGE_PATH, url.origin);
    const assetResponse = await env.ASSETS.fetch(new Request(assetUrl));
    if (!assetResponse.ok) throw new Error(`Rich Menu image asset unavailable: HTTP ${assetResponse.status}`);
    const imageBytes = await assetResponse.arrayBuffer();
    if (!imageBytes.byteLength || imageBytes.byteLength > 1_000_000) throw new Error(`Rich Menu image size invalid: ${imageBytes.byteLength}`);
    await lineApiRequest(`https://api-data.line.me/v2/bot/richmenu/${encodeURIComponent(newRichMenuId)}/content`, env.LINE_CHANNEL_ACCESS_TOKEN, {
      method: "POST",
      headers: { "content-type": "image/png" },
      body: imageBytes,
    });
    await env.CRM_DB.prepare("UPDATE rich_menu_versions SET line_rich_menu_id = ?, status = 'uploaded', updated_at = ? WHERE id = ?")
      .bind(newRichMenuId, new Date().toISOString(), versionId).run();

    await updatePublishRun(env.CRM_DB, runId, "alias", previousRichMenuId, newRichMenuId);
    await upsertRichMenuAlias(env.LINE_CHANNEL_ACCESS_TOKEN, RICH_MENU_ALIAS_ID, newRichMenuId);

    await updatePublishRun(env.CRM_DB, runId, "set_default", previousRichMenuId, newRichMenuId);
    await lineApiRequest(`https://api.line.me/v2/bot/user/all/richmenu/${encodeURIComponent(newRichMenuId)}`, env.LINE_CHANNEL_ACCESS_TOKEN, { method: "POST" });

    await updatePublishRun(env.CRM_DB, runId, "verify", previousRichMenuId, newRichMenuId);
    await verifyDefaultRichMenu(env.LINE_CHANNEL_ACCESS_TOKEN, newRichMenuId);

    const finishedAt = new Date().toISOString();
    await env.CRM_DB.batch([
      env.CRM_DB.prepare("UPDATE rich_menu_versions SET status = 'retired', updated_at = ? WHERE status = 'active' AND id <> ?").bind(finishedAt, versionId),
      env.CRM_DB.prepare("UPDATE rich_menu_versions SET status = 'active', published_at = ?, updated_at = ? WHERE id = ?").bind(finishedAt, finishedAt, versionId),
      env.CRM_DB.prepare("UPDATE rich_menu_projects SET status = 'published', current_version_id = ?, updated_at = ? WHERE id = ?").bind(versionId, finishedAt, projectId),
      env.CRM_DB.prepare("UPDATE rich_menu_publish_runs SET stage = 'verified', status = 'succeeded', previous_line_rich_menu_id = ?, new_line_rich_menu_id = ?, finished_at = ? WHERE id = ?").bind(previousRichMenuId, newRichMenuId, finishedAt, runId),
      env.CRM_DB.prepare("INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, detail_json, created_at) VALUES (?, 'admin', 'rich_menu.publish', 'rich_menu_project', ?, ?, ?)")
        .bind(crypto.randomUUID(), projectId, JSON.stringify({ versionId, previousRichMenuId, newRichMenuId }), finishedAt),
    ]);

    const cleanup = await cleanupOldRichMenu(env.LINE_CHANNEL_ACCESS_TOKEN, previousRichMenuId, newRichMenuId);
    return adminJson({ ok: true, projectId, versionId, previousRichMenuId, newRichMenuId, verified: true, cleanup });
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const safeMessage = String(error?.message || error).slice(0, 500);
    await env.CRM_DB.batch([
      env.CRM_DB.prepare("UPDATE rich_menu_versions SET line_rich_menu_id = ?, status = 'failed', updated_at = ? WHERE id = ?").bind(newRichMenuId, finishedAt, versionId),
      env.CRM_DB.prepare("UPDATE rich_menu_projects SET status = 'failed', updated_at = ? WHERE id = ?").bind(finishedAt, projectId),
      env.CRM_DB.prepare("UPDATE rich_menu_publish_runs SET stage = 'failed', status = 'failed', previous_line_rich_menu_id = ?, new_line_rich_menu_id = ?, error_message = ?, finished_at = ? WHERE id = ?")
        .bind(previousRichMenuId, newRichMenuId, safeMessage, finishedAt, runId),
    ]).catch(() => undefined);
    console.error(JSON.stringify({ level: "error", message: "Rich Menu publish failed", projectId, runId, error: safeMessage }));
    return adminJson({ error: "rich_menu_publish_failed", message: safeMessage, runId }, 502);
  }
}

async function updatePublishRun(db, runId, stage, previousId, newId) {
  await db.prepare("UPDATE rich_menu_publish_runs SET stage = ?, previous_line_rich_menu_id = ?, new_line_rich_menu_id = ? WHERE id = ?")
    .bind(stage, previousId || null, newId || null, runId).run();
}

async function getDefaultRichMenu(accessToken) {
  const response = await fetch("https://api.line.me/v2/bot/user/all/richmenu", { headers: { authorization: `Bearer ${accessToken}` } });
  if (response.status === 404) return { source: "none", richMenuId: null };
  if (response.status === 403) return { source: "manager_or_other_channel", richMenuId: null };
  if (!response.ok) throw new Error(`LINE get default failed: HTTP ${response.status} ${await readTextLimited(response)}`);
  const data = await response.json();
  return { source: "messaging_api", richMenuId: String(data.richMenuId || "") || null };
}

async function upsertRichMenuAlias(accessToken, aliasId, richMenuId) {
  const lookup = await fetch(`https://api.line.me/v2/bot/richmenu/alias/${encodeURIComponent(aliasId)}`, { headers: { authorization: `Bearer ${accessToken}` } });
  if (lookup.ok) {
    await lineApiRequest(`https://api.line.me/v2/bot/richmenu/alias/${encodeURIComponent(aliasId)}`, accessToken, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ richMenuId }),
    });
    return;
  }
  if (lookup.status !== 404) throw new Error(`LINE alias lookup failed: HTTP ${lookup.status} ${await readTextLimited(lookup)}`);
  await lineApiRequest("https://api.line.me/v2/bot/richmenu/alias", accessToken, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ richMenuAliasId: aliasId, richMenuId }),
  });
}

async function verifyDefaultRichMenu(accessToken, expectedId) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const current = await getDefaultRichMenu(accessToken);
    if (current.richMenuId === expectedId) return;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw new Error("LINE default Rich Menu verification timed out");
}

async function cleanupOldRichMenu(accessToken, previousId, currentId) {
  if (!previousId || previousId === currentId) return { attempted: false, reason: "no_previous_menu" };
  try {
    const aliases = await lineApiRequest("https://api.line.me/v2/bot/richmenu/alias/list", accessToken, {}, true);
    const referenced = (aliases.richMenuAliases || []).some((alias) => alias.richMenuId === previousId);
    if (referenced) return { attempted: false, reason: "previous_menu_has_alias" };
    await lineApiRequest(`https://api.line.me/v2/bot/richmenu/${encodeURIComponent(previousId)}`, accessToken, { method: "DELETE" });
    return { attempted: true, deleted: true };
  } catch (error) {
    return { attempted: true, deleted: false, error: String(error?.message || error).slice(0, 200) };
  }
}

async function lineApiRequest(endpoint, accessToken, init = {}, parseJson = false) {
  const headers = new Headers(init.headers || {});
  headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(endpoint, { ...init, headers });
  if (!response.ok) throw new Error(`LINE API failed: HTTP ${response.status} ${await readTextLimited(response)}`);
  if (!parseJson) return null;
  return response.json();
}

async function readTextLimited(response, maxBytes = 8192) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      const remaining = maxBytes - total;
      chunks.push(value.slice(0, remaining));
      total += Math.min(value.byteLength, remaining);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
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

async function getAdminSystemStatus(env, url) {
  const dbCheck = await env.CRM_DB.prepare("SELECT COUNT(*) AS count FROM crm_contacts").first();
  return adminJson({
    ok: true,
    service: "joson-care",
    origin: url.origin,
    database: { configured: Boolean(env.CRM_DB), reachable: Boolean(dbCheck), contacts: Number(dbCheck?.count || 0) },
    line: {
      channelSecret: Boolean(env.LINE_CHANNEL_SECRET),
      accessToken: Boolean(env.LINE_CHANNEL_ACCESS_TOKEN),
      loginSecret: Boolean(env.LINE_LOGIN_CHANNEL_SECRET),
      loginChannelId: String(env.LINE_LOGIN_CHANNEL_ID || ""),
      liffId: String(env.LIFF_ID || ""),
    },
    admin: { accessKey: Boolean(env.ADMIN_ACCESS_KEY) },
    ai: { mode: "rule_based", externalModel: false },
    routes: {
      webhook: `${url.origin}/line-webhook`,
      callback: `${url.origin}/callback`,
      liff: `${url.origin}/liff`,
      health: `${url.origin}/health`,
    },
  });
}

async function getChatInsights(db) {
  const results = await db.batch([
    db.prepare("SELECT COUNT(*) AS count FROM crm_threads WHERE unread_count > 0"),
    db.prepare("SELECT COUNT(*) AS count FROM crm_thread_monitor_state WHERE priority >= 2"),
    db.prepare("SELECT COUNT(*) AS count FROM crm_threads WHERE status IN ('open', 'pending')"),
    db.prepare("SELECT COUNT(*) AS count FROM crm_messages WHERE direction = 'inbound' AND sent_at >= datetime('now', '-7 days')"),
    db.prepare(`SELECT COALESCE(intent, 'general_message') AS intent, COUNT(*) AS count
      FROM crm_events WHERE occurred_at >= datetime('now', '-30 days')
      GROUP BY COALESCE(intent, 'general_message') ORDER BY count DESC LIMIT 6`),
    db.prepare(`SELECT product_model, COUNT(*) AS count FROM crm_events
      WHERE product_model IS NOT NULL AND occurred_at >= datetime('now', '-30 days')
      GROUP BY product_model ORDER BY count DESC LIMIT 6`),
  ]);
  return adminJson({
    ok: true,
    unreadThreads: numberFromResult(results[0]),
    highPriority: numberFromResult(results[1]),
    activeThreads: numberFromResult(results[2]),
    inbound7d: numberFromResult(results[3]),
    topIntents: results[4].results || [],
    topProducts: results[5].results || [],
    analysisMode: "rule_based",
  });
}

async function getChatThreads(db, url) {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 60), 1), 100);
  const query = String(url.searchParams.get("q") || "").trim().slice(0, 120);
  const stage = String(url.searchParams.get("stage") || "").trim();
  const intent = String(url.searchParams.get("intent") || "").trim();
  const status = String(url.searchParams.get("status") || "").trim();
  const priorityRaw = String(url.searchParams.get("priority") || "").trim();
  const unread = url.searchParams.get("unread") === "1";
  const conditions = [];
  const values = [];
  if (["new", "selecting", "lead", "customer", "after_sales", "inactive"].includes(stage)) { conditions.push("c.lifecycle_stage = ?"); values.push(stage); }
  if (["open", "pending", "closed"].includes(status)) { conditions.push("t.status = ?"); values.push(status); }
  if (intent) { conditions.push("m.last_intent = ?"); values.push(intent); }
  if (/^[0-3]$/.test(priorityRaw)) { conditions.push("COALESCE(m.priority, 0) = ?"); values.push(Number(priorityRaw)); }
  if (unread) conditions.push("t.unread_count > 0");
  if (query) {
    const needle = `%${query}%`;
    conditions.push("(c.display_name LIKE ? OR c.line_user_id LIKE ? OR t.last_message_preview LIKE ? OR m.last_product_model LIKE ?)");
    values.push(needle, needle, needle, needle);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db.prepare(`SELECT
      t.id, t.status, t.unread_count, t.last_message_preview, t.last_message_at,
      c.id AS contact_id, c.line_user_id, c.display_name, c.picture_url, c.friend_status, c.lifecycle_stage,
      COALESCE(m.priority, 0) AS priority, m.assigned_to, m.last_intent, m.last_product_model,
      m.analysis_mode, m.reviewed_at,
      (SELECT GROUP_CONCAT(tag.name, ', ') FROM crm_contact_tags ct JOIN crm_tags tag ON tag.id = ct.tag_id WHERE ct.contact_id = c.id) AS tags,
      (SELECT l.status FROM crm_leads l WHERE l.contact_id = c.id ORDER BY l.updated_at DESC LIMIT 1) AS lead_status
    FROM crm_threads t
    JOIN crm_contacts c ON c.id = t.contact_id
    LEFT JOIN crm_thread_monitor_state m ON m.thread_id = t.id
    ${where}
    ORDER BY COALESCE(m.priority, 0) DESC, t.unread_count DESC, t.last_message_at DESC
    LIMIT ?`).bind(...values, limit).all();
  return adminJson({ ok: true, threads: result.results || [] });
}

async function getChatThread(db, threadId) {
  const results = await db.batch([
    db.prepare(`SELECT t.*, c.line_user_id, c.display_name, c.picture_url, c.friend_status, c.lifecycle_stage,
      COALESCE(m.priority, 0) AS priority, m.assigned_to, m.last_intent, m.last_product_model, m.analysis_mode, m.reviewed_at,
      (SELECT GROUP_CONCAT(tag.name, ', ') FROM crm_contact_tags ct JOIN crm_tags tag ON tag.id = ct.tag_id WHERE ct.contact_id = c.id) AS tags
      FROM crm_threads t JOIN crm_contacts c ON c.id = t.contact_id
      LEFT JOIN crm_thread_monitor_state m ON m.thread_id = t.id WHERE t.id = ?`).bind(threadId),
    db.prepare(`SELECT * FROM (SELECT id, direction, message_type, text_content, payload_summary, sent_at
      FROM crm_messages WHERE thread_id = ? ORDER BY sent_at DESC LIMIT 200) ORDER BY sent_at ASC`).bind(threadId),
    db.prepare(`SELECT e.event_type, e.source, e.intent, e.product_model, e.occurred_at
      FROM crm_events e JOIN crm_threads t ON t.contact_id = e.contact_id WHERE t.id = ? ORDER BY e.occurred_at DESC LIMIT 50`).bind(threadId),
    db.prepare(`SELECT l.* FROM crm_leads l JOIN crm_threads t ON t.contact_id = l.contact_id WHERE t.id = ? ORDER BY l.updated_at DESC`).bind(threadId),
    db.prepare(`SELECT n.* FROM crm_notes n JOIN crm_threads t ON t.contact_id = n.contact_id WHERE t.id = ? ORDER BY n.created_at DESC LIMIT 50`).bind(threadId),
  ]);
  const thread = results[0].results?.[0];
  if (!thread) return adminJson({ error: "thread_not_found" }, 404);
  return adminJson({
    ok: true,
    thread,
    messages: results[1].results || [],
    events: results[2].results || [],
    leads: results[3].results || [],
    notes: results[4].results || [],
    recommendation: monitorRecommendation(thread.last_intent, thread.last_product_model, thread.lifecycle_stage),
  });
}

function monitorRecommendation(intent, productModel, stage) {
  if (intent === "contact_request") return "顧客已要求聯絡，建議優先由專人回覆並建立追蹤時間。";
  if (intent === "procurement") return "屬於機構採購訊號，建議確認數量、交期、規格與報價窗口。";
  if (intent === "after_sales") return "屬於售後需求，建議先確認型號、故障情況、購買時間與所在區域。";
  if (productModel) return `目前規則推薦 ${productModel}，建議確認照護者操作需求與居家空間。`;
  if (stage === "selecting") return "顧客正在選型，建議補問床面高度、空間、護欄與操作需求。";
  return "目前為一般互動，可持續觀察下一則訊息或加入人工備註。";
}

async function markChatThreadRead(db, threadId) {
  const now = new Date().toISOString();
  const thread = await db.prepare("SELECT id FROM crm_threads WHERE id = ?").bind(threadId).first();
  if (!thread) return adminJson({ error: "thread_not_found" }, 404);
  await db.batch([
    db.prepare("UPDATE crm_threads SET unread_count = 0, updated_at = ? WHERE id = ?").bind(now, threadId),
    db.prepare(`INSERT INTO crm_thread_monitor_state (thread_id, priority, analysis_mode, reviewed_at, created_at, updated_at)
      VALUES (?, 0, 'rule_based', ?, ?, ?)
      ON CONFLICT(thread_id) DO UPDATE SET reviewed_at = excluded.reviewed_at, updated_at = excluded.updated_at`).bind(threadId, now, now, now),
    db.prepare(`INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, detail_json, created_at)
      VALUES (?, 'admin', 'chat.mark_read', 'thread', ?, '{}', ?)`).bind(crypto.randomUUID(), threadId, now),
  ]);
  return adminJson({ ok: true });
}

async function updateChatThread(request, db, threadId) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 10000) return adminJson({ error: "payload_too_large" }, 413);
  const payload = await request.json().catch(() => ({}));
  const status = String(payload.status || "").trim();
  const assignedTo = String(payload.assignedTo || "").trim().slice(0, 120);
  const priority = Number(payload.priority);
  if (status && !["open", "pending", "closed"].includes(status)) return adminJson({ error: "invalid_status" }, 400);
  if (!Number.isInteger(priority) || priority < 0 || priority > 3) return adminJson({ error: "invalid_priority" }, 400);
  const thread = await db.prepare("SELECT id FROM crm_threads WHERE id = ?").bind(threadId).first();
  if (!thread) return adminJson({ error: "thread_not_found" }, 404);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("UPDATE crm_threads SET status = CASE WHEN ? = '' THEN status ELSE ? END, updated_at = ? WHERE id = ?").bind(status, status, now, threadId),
    db.prepare(`INSERT INTO crm_thread_monitor_state (thread_id, priority, assigned_to, analysis_mode, created_at, updated_at)
      VALUES (?, ?, ?, 'rule_based', ?, ?)
      ON CONFLICT(thread_id) DO UPDATE SET priority = excluded.priority, assigned_to = excluded.assigned_to, updated_at = excluded.updated_at`)
      .bind(threadId, priority, assignedTo || null, now, now),
    db.prepare(`INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, detail_json, created_at)
      VALUES (?, 'admin', 'chat.update', 'thread', ?, ?, ?)`)
      .bind(crypto.randomUUID(), threadId, JSON.stringify({ status: status || null, priority, assignedTo: assignedTo || null }), now),
  ]);
  return adminJson({ ok: true });
}

async function createChatThreadNote(request, db, threadId) {
  const thread = await db.prepare("SELECT contact_id FROM crm_threads WHERE id = ?").bind(threadId).first();
  if (!thread) return adminJson({ error: "thread_not_found" }, 404);
  return createAdminNote(request, db, thread.contact_id);
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

function isBearerAuthorized(request, secret) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") && timingSafeTextEqual(authorization.slice(7), secret);
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

function adminNav(active) {
  const items = [
    ["overview", "/admin", "總覽", "⌂"],
    ["crm", "/admin/crm", "CRM", "◎"],
    ["products", "/admin/products", "商品區", "▦"],
    ["rich-menu", "/admin/rich-menu", "圖文選單", "▤"],
    ["settings", "/admin/settings", "設定區", "⚙"],
  ];
  return items.map(([key, href, label, icon]) => `<a href="${href}" class="admin-nav-item${active === key ? " active" : ""}"><span>${icon}</span><b>${label}</b></a>`).join("");
}

function adminPage(active, title, subtitle, content, script = "") {
  return page(`${title}｜Joson 管理中心`, `<div class="admin-shell"><aside class="admin-sidebar"><a class="admin-brand" href="/admin"><span class="brand-mark">J</span><span><b>JOSON</b><small>CARE CONSOLE</small></span></a><nav>${adminNav(active)}</nav><div class="sidebar-foot"><span class="online-dot"></span>系統運作中<form method="post" action="/admin/logout"><button class="logout-button">安全登出</button></form></div></aside><div class="admin-workspace"><header class="admin-header"><div><div class="eyebrow">JOSON CARE OPERATIONS</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div><a class="public-link" href="/" target="_blank" rel="noopener">開啟前台 ↗</a></header><main class="admin-content">${content}</main></div></div>${script ? `<script>${script}</script>` : ""}`);
}

function commonAdminScript() {
  return `const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const fmt=v=>v?new Date(v).toLocaleString('zh-TW',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';async function api(url,options){const r=await fetch(url,options);if(r.status===401){location.href='/admin/login';throw new Error('unauthorized')}const d=await r.json();if(!r.ok)throw new Error(d.message||d.error||'request_failed');return d}`;
}

function renderAdminPage() {
  const content = `<section class="stats" id="stats"><div class="stat">載入中…</div></section><section class="dashboard-grid"><div class="panel span-two"><div class="section-title"><div><div class="eyebrow">RECENT ACTIVITY</div><h2>最近會員互動</h2></div><a class="text-link" href="/admin/crm">查看全部 CRM →</a></div><div class="table-wrap"><table><thead><tr><th>會員</th><th>階段</th><th>標籤</th><th>最後訊息</th><th>時間</th></tr></thead><tbody id="contacts"><tr><td colspan="5">載入中…</td></tr></tbody></table></div></div><aside class="panel menu-overview"><div class="eyebrow">RICH MENU LIVE</div><h2>客製智能圖文選單</h2><img class="menu-preview" src="${RICH_MENU_IMAGE_PATH}" alt="Joson 客製智能圖文選單預覽"><div id="menu-status" class="menu-status">讀取上架狀態…</div><a class="primary-link" href="/admin/rich-menu">管理圖文選單</a></aside></section><section class="module-grid"><a href="/admin/crm" class="module-card"><span class="module-icon">◎</span><div><b>CRM 與聊天室</b><p>會員、商機、未讀與智能判讀</p></div><span>→</span></a><a href="/admin/products" class="module-card"><span class="module-icon">▦</span><div><b>商品資料庫</b><p id="product-module">85 款繁中商品與四款精選</p></div><span>→</span></a><a href="/admin/rich-menu" class="module-card"><span class="module-icon">▤</span><div><b>智能圖文選單</b><p>模板、專案、發布與線上驗證</p></div><span>→</span></a><a href="/admin/settings" class="module-card"><span class="module-icon">⚙</span><div><b>系統設定</b><p>LINE、LIFF、D1 與安全狀態</p></div><span>→</span></a></section>`;
  const script = `${commonAdminScript()}async function load(){const [s,c,m,p]=await Promise.all([api('/api/admin/summary'),api('/api/admin/contacts?limit=8'),api('/api/admin/rich-menu/status'),api('/api/products')]);document.getElementById('stats').innerHTML=[['會員總數',s.contacts,'CRM'],['7 日活躍',s.active7d,'近一週'],['進行中商機',s.openLeads,'需追蹤'],['未讀對話',s.unreadThreads,'LINE']].map(x=>'<div class="stat"><span>'+e(x[2])+'</span><strong>'+e(x[1])+'</strong><small>'+e(x[0])+'</small></div>').join('');document.getElementById('contacts').innerHTML=c.contacts.length?c.contacts.map(x=>'<tr><td><b>'+e(x.display_name||'LINE 會員')+'</b></td><td><span class="badge">'+e(x.lifecycle_stage)+'</span></td><td>'+e(x.tags||'—')+'</td><td>'+e(x.last_message_preview||'—')+'</td><td>'+e(fmt(x.last_message_at||x.last_seen_at))+'</td></tr>').join(''):'<tr><td colspan="5">尚無會員互動資料</td></tr>';const project=m.project||{};document.getElementById('menu-status').innerHTML='<strong>'+e(project.status||'draft')+'</strong><span>'+e(project.name||'尚無專案')+'</span><span>'+e(m.lineDefault?.richMenuId||'未設定 LINE 預設選單')+'</span>';document.getElementById('product-module').textContent=p.catalogTotal+' 款繁中商品與 '+p.products.filter(x=>x.featured).length+' 款精選'}load();`;
  return adminPage("overview", "營運總覽", "集中查看會員、商機、商品與 LINE 服務狀態。", content, script);
}

function renderChatMonitorPage() {
  const content = `<style>.monitor-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}.monitor-grid{display:grid;grid-template-columns:370px minmax(0,1fr);gap:16px;min-height:650px}.monitor-list,.conversation{padding:0;overflow:hidden}.monitor-toolbar{padding:16px;border-bottom:1px solid #e2ebe8}.filters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.filters input{grid-column:1/-1}.filters select,.thread-controls select,.thread-controls input,textarea{width:100%;padding:10px;border:1px solid #bfd1cc;border-radius:9px;background:#fff;font:inherit}.thread-list{max-height:610px;overflow:auto}.thread-card{display:block;width:100%;padding:14px 16px;border:0;border-bottom:1px solid #e7eeec;border-radius:0;background:#fff;color:#17332e;text-align:left}.thread-card:hover,.thread-card.active{background:#eaf4f1}.thread-top{display:flex;justify-content:space-between;gap:10px}.thread-name{font-weight:850}.thread-meta,.thread-preview{font-size:12px;color:#667d76}.thread-preview{margin:7px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.chips{display:flex;flex-wrap:wrap;gap:5px}.chip{padding:3px 7px;border-radius:999px;background:#e5efec;color:#175b49;font-size:11px}.chip.p3{background:#fee2e2;color:#9b1c1c}.chip.p2{background:#fff0d5;color:#8a4b08}.unread{padding:2px 7px;border-radius:99px;background:#c53030;color:#fff;font-size:12px}.conversation-empty{display:grid;place-items:center;min-height:620px;color:#657a74;text-align:center;padding:30px}.conversation-head{padding:17px 20px;border-bottom:1px solid #e2ebe8}.conversation-title{display:flex;justify-content:space-between;gap:12px}.analysis{margin-top:12px;padding:12px;border-radius:11px;background:#edf5f2}.analysis strong{display:block}.thread-controls{display:grid;grid-template-columns:1fr 1fr 1.2fr auto;gap:8px;margin-top:12px}.timeline{height:390px;overflow:auto;padding:18px;background:#f7faf9}.message{display:flex;margin:8px 0}.message.outbound{justify-content:flex-end}.bubble{max-width:76%;padding:10px 12px;border-radius:14px;background:#fff;border:1px solid #dde8e4;white-space:pre-wrap}.outbound .bubble{background:#dff1ea}.bubble time{display:block;margin-top:5px;color:#71847e;font-size:10px}.conversation-foot{display:grid;grid-template-columns:1fr auto;gap:8px;padding:15px 20px}.conversation-foot textarea{min-height:68px}.notes{padding:0 20px 18px}.note{padding:9px 0;border-bottom:1px solid #e7eeec;font-size:13px}@media(max-width:1050px){.monitor-grid{grid-template-columns:1fr}.thread-list{max-height:330px}.conversation-empty{min-height:300px}}@media(max-width:600px){.filters,.thread-controls{grid-template-columns:1fr}.filters input{grid-column:auto}.monitor-stats{grid-template-columns:1fr 1fr}.conversation-foot{grid-template-columns:1fr}}</style><div class="info-strip"><span class="online-dot"></span><b>規則引擎即時判讀</b><span>不使用外部 AI 額度，15 秒更新</span></div><section class="monitor-stats" id="monitor-stats"><div class="stat">載入中…</div></section><section class="monitor-grid"><aside class="panel monitor-list"><div class="monitor-toolbar"><div class="section-title"><h2>LINE 對話</h2><button class="secondary" id="refresh-button">更新</button></div><div class="filters"><input id="search" placeholder="搜尋姓名、訊息或型號"><select id="unread-filter"><option value="">全部訊息</option><option value="1">只看未讀</option></select><select id="priority-filter"><option value="">全部優先級</option><option value="3">緊急</option><option value="2">高</option><option value="1">一般追蹤</option><option value="0">低</option></select><select id="stage-filter"><option value="">全部階段</option><option value="new">新會員</option><option value="selecting">選型中</option><option value="lead">商機</option><option value="customer">客戶</option><option value="after_sales">售後</option></select><select id="status-filter"><option value="">全部狀態</option><option value="open">處理中</option><option value="pending">待追蹤</option><option value="closed">已結案</option></select></div></div><div class="thread-list" id="thread-list"><div class="conversation-empty">正在讀取對話…</div></div></aside><section class="panel conversation" id="conversation"><div class="conversation-empty"><div><h2>選擇一則對話</h2><p>查看完整訊息、智能判讀與 CRM 備註。</p></div></div></section></section>`;
  const script = `${commonAdminScript()}const labels={contact_request:'要求聯絡',procurement:'機構採購',after_sales:'售後服務',low_bed:'低床需求',space_saving:'空間收納',four_rail:'四片護欄',professional_controls:'完整操作',start_advisor:'開始選床',compare_products:'床型比較',browse_products:'瀏覽產品',general_message:'一般訊息',line_event:'LINE 事件'};const priorities=['低','一般追蹤','高','緊急'];let selectedId='';let searchTimer;async function loadInsights(){const d=await api('/api/admin/chat/insights');document.getElementById('monitor-stats').innerHTML=[['未讀',d.unreadThreads],['高優先',d.highPriority],['處理中',d.activeThreads],['7 日訊息',d.inbound7d]].map(x=>'<div class="stat"><strong>'+e(x[1])+'</strong><small>'+e(x[0])+'</small></div>').join('')}function query(){const p=new URLSearchParams({limit:'60'});[['q','search'],['unread','unread-filter'],['priority','priority-filter'],['stage','stage-filter'],['status','status-filter']].forEach(x=>{const v=document.getElementById(x[1]).value.trim();if(v)p.set(x[0],v)});return p}async function loadThreads(){const d=await api('/api/admin/chat/threads?'+query());const box=document.getElementById('thread-list');box.innerHTML=d.threads.length?d.threads.map(t=>'<button class="thread-card '+(t.id===selectedId?'active':'')+'" data-id="'+e(t.id)+'"><div class="thread-top"><span class="thread-name">'+e(t.display_name||'LINE 會員')+'</span>'+(t.unread_count?'<span class="unread">'+e(t.unread_count)+'</span>':'')+'</div><div class="thread-preview">'+e(t.last_message_preview||'尚無文字訊息')+'</div><div class="chips"><span class="chip p'+e(t.priority)+'">'+e(priorities[t.priority]||'低')+'</span><span class="chip">'+e(labels[t.last_intent]||t.last_intent||'未分類')+'</span>'+(t.last_product_model?'<span class="chip">'+e(t.last_product_model)+'</span>':'')+'</div><div class="thread-meta">'+e(fmt(t.last_message_at))+' · '+e(t.lifecycle_stage)+'</div></button>').join(''):'<div class="conversation-empty">沒有符合條件的對話</div>';box.querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',()=>openThread(b.dataset.id)))}async function openThread(id){selectedId=id;await Promise.all([loadThread(),loadThreads()])}async function loadThread(){if(!selectedId)return;const d=await api('/api/admin/chat/threads/'+encodeURIComponent(selectedId));const t=d.thread;const messages=d.messages.map(m=>'<div class="message '+e(m.direction)+'"><div class="bubble">'+e(m.text_content||m.payload_summary||m.message_type)+'<time>'+e(m.direction==='inbound'?'會員':'系統回覆')+' · '+e(fmt(m.sent_at))+'</time></div></div>').join('');const notes=d.notes.map(n=>'<div class="note">'+e(n.note)+'<div class="thread-meta">'+e(fmt(n.created_at))+'</div></div>').join('')||'<div class="note muted">尚無備註</div>';document.getElementById('conversation').innerHTML='<div class="conversation-head"><div class="conversation-title"><div><div class="eyebrow">'+e(t.lifecycle_stage)+' · '+e(t.tags||'無標籤')+'</div><h2>'+e(t.display_name||'LINE 會員')+'</h2><div class="thread-meta">最後互動 '+e(fmt(t.last_message_at))+'</div></div>'+(t.unread_count?'<button id="read-button">標為已讀 ('+e(t.unread_count)+')</button>':'<span class="chip">已讀</span>')+'</div><div class="analysis"><strong>智能判讀：'+e(labels[t.last_intent]||t.last_intent||'未分類')+(t.last_product_model?' · 推薦 '+e(t.last_product_model):'')+'</strong><span>'+e(d.recommendation)+'</span></div><div class="thread-controls"><select id="edit-status"><option value="open">處理中</option><option value="pending">待追蹤</option><option value="closed">已結案</option></select><select id="edit-priority"><option value="0">低</option><option value="1">一般</option><option value="2">高</option><option value="3">緊急</option></select><input id="edit-assignee" placeholder="負責人" value="'+e(t.assigned_to||'')+'"><button id="save-button">儲存</button></div></div><div class="timeline" id="timeline">'+messages+'</div><div class="conversation-foot"><textarea id="note-text" placeholder="新增內部備註，不會傳給會員"></textarea><button id="note-button">加入備註</button></div><div class="notes"><details><summary>CRM 備註 ('+e(d.notes.length)+')</summary>'+notes+'</details></div>';document.getElementById('edit-status').value=t.status;document.getElementById('edit-priority').value=String(t.priority);const timeline=document.getElementById('timeline');timeline.scrollTop=timeline.scrollHeight;document.getElementById('read-button')?.addEventListener('click',markRead);document.getElementById('save-button').addEventListener('click',saveThread);document.getElementById('note-button').addEventListener('click',addNote)}async function markRead(){await api('/api/admin/chat/threads/'+encodeURIComponent(selectedId)+'/read',{method:'POST'});await refreshAll()}async function saveThread(){await api('/api/admin/chat/threads/'+encodeURIComponent(selectedId),{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status:document.getElementById('edit-status').value,priority:Number(document.getElementById('edit-priority').value),assignedTo:document.getElementById('edit-assignee').value})});await refreshAll()}async function addNote(){const i=document.getElementById('note-text');if(!i.value.trim())return;await api('/api/admin/chat/threads/'+encodeURIComponent(selectedId)+'/notes',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({note:i.value.trim()})});i.value='';await loadThread()}async function refreshAll(){await Promise.all([loadInsights(),loadThreads(),selectedId?loadThread():Promise.resolve()])}document.getElementById('refresh-button').addEventListener('click',refreshAll);['unread-filter','priority-filter','stage-filter','status-filter'].forEach(id=>document.getElementById(id).addEventListener('change',loadThreads));document.getElementById('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(loadThreads,250)});refreshAll();setInterval(()=>{if(!document.hidden)Promise.all([loadInsights(),loadThreads()])},15000);`;
  return adminPage("crm", "CRM 與 AI 聊天室", "管理 LINE 對話、智能需求判讀、商機優先級與內部追蹤。", content, script);
}

function renderAdminProductsPage() {
  const content = `<section class="stats" id="product-stats"><div class="stat">載入中…</div></section><section class="panel"><div class="section-title"><div><div class="eyebrow">PRODUCT CATALOG</div><h2>繁中商品資料庫</h2></div><a class="primary-link" href="/products" target="_blank" rel="noopener">前台商品頁 ↗</a></div><div class="catalog-tools"><input id="product-search" placeholder="搜尋型號、名稱、分類或特色"><select id="product-filter"><option value="all">全部商品</option><option value="featured">四款推薦</option><option value="available">資料完整</option><option value="unavailable">來源缺頁</option></select></div><div id="product-table" class="table-wrap"><table><tbody><tr><td>正在讀取商品…</td></tr></tbody></table></div></section>`;
  const script = `${commonAdminScript()}let products=[];let generatedAt='';function render(){const q=document.getElementById('product-search').value.trim().toLowerCase();const f=document.getElementById('product-filter').value;const list=products.filter(p=>(!q||[p.model,p.name,p.category,p.summary].join(' ').toLowerCase().includes(q))&&(f==='all'||(f==='featured'&&p.featured)||(f==='available'&&!p.unavailable)||(f==='unavailable'&&p.unavailable)));document.getElementById('product-table').innerHTML='<table><thead><tr><th>商品</th><th>分類</th><th>特色／規格</th><th>狀態</th><th></th></tr></thead><tbody>'+list.map(p=>'<tr><td><div class="product-cell">'+(p.image?'<img src="'+e(p.image)+'" alt="">':'<span class="product-placeholder">J</span>')+'<div><b>'+e(p.model||p.name)+'</b><small>'+e(p.name)+'</small></div></div></td><td>'+e(p.category||'—')+'</td><td><span class="clamp">'+e((p.highlights||[]).slice(0,2).join('、')||(p.specs||[]).slice(0,2).map(x=>x.label+' '+x.value).join('、')||'—')+'</span></td><td><span class="badge">'+e(p.unavailable?'來源缺頁':p.featured?'推薦商品':'已收錄')+'</span></td><td><a class="text-link" href="/products/'+encodeURIComponent(p.slug)+'" target="_blank">預覽 ↗</a></td></tr>').join('')+'</tbody></table>';document.getElementById('product-count').textContent=list.length}async function load(){const d=await api('/api/products');products=d.products;generatedAt=d.generatedAt;document.getElementById('product-stats').innerHTML=[['商品總數',d.catalogTotal],['目前顯示','<span id="product-count">'+d.catalogTotal+'</span>'],['四款精選',products.filter(x=>x.featured).length],['資料快照',new Date(generatedAt).toLocaleDateString('zh-TW')]].map(x=>'<div class="stat"><strong>'+x[1]+'</strong><small>'+e(x[0])+'</small></div>').join('');render()}document.getElementById('product-search').addEventListener('input',render);document.getElementById('product-filter').addEventListener('change',render);load();`;
  return adminPage("products", "商品區", "快速檢視 85 款繁中商品、推薦品、規格與前台呈現。", content, script);
}

function renderAdminRichMenuPage() {
  const content = `<section class="rich-grid"><div class="panel"><div class="section-title"><div><div class="eyebrow">LIVE PREVIEW</div><h2>Joson 客製智能圖文選單</h2></div><span class="badge" id="publish-status">讀取中</span></div><img class="menu-preview large" src="${RICH_MENU_IMAGE_PATH}" alt="客製智能圖文選單"><div class="action-row"><button id="publish-button">發布目前專案</button><button class="secondary" id="verify-button">驗證線上版本</button></div><div id="verify-result" class="menu-status">尚未執行驗證</div></div><aside><div class="panel"><div class="eyebrow">PROJECT</div><h2>上架專案</h2><div id="project-detail" class="detail-list">載入中…</div></div><div class="panel top-gap"><div class="eyebrow">TEMPLATES</div><h2>模板庫</h2><div id="template-list" class="detail-list">載入中…</div></div></aside></section>`;
  const script = `${commonAdminScript()}async function load(){const [s,t,p]=await Promise.all([api('/api/admin/rich-menu/status'),api('/api/admin/rich-menu/templates'),api('/api/admin/rich-menu/projects')]);const x=s.project||{};document.getElementById('publish-status').textContent=x.status||'draft';document.getElementById('project-detail').innerHTML=[['專案名稱',x.name],['使用模板',x.template_name],['LINE Rich Menu',s.lineDefault?.richMenuId],['發布時間',fmt(x.published_at)]].map(r=>'<div><span>'+e(r[0])+'</span><b>'+e(r[1]||'—')+'</b></div>').join('');document.getElementById('template-list').innerHTML=t.templates.map(x=>'<div><span>'+e(x.name)+'</span><b>'+e(x.width)+' × '+e(x.height)+'</b></div>').join('')}async function publish(){if(!confirm('確定發布目前的 Joson 客製圖文選單？'))return;const b=document.getElementById('publish-button');b.disabled=true;b.textContent='發布中…';try{const d=await api('/api/admin/rich-menu/projects/${RICH_MENU_PROJECT_ID}/publish',{method:'POST'});alert('發布成功：'+d.newRichMenuId);await load();await verify()}catch(err){alert('發布失敗：'+err.message)}finally{b.disabled=false;b.textContent='發布目前專案'}}async function verify(){const b=document.getElementById('verify-button');b.disabled=true;try{const d=await api('/api/admin/rich-menu/verify');document.getElementById('verify-result').innerHTML='<strong>'+(d.ok?'驗證通過':'驗證未通過')+'</strong><span>預設選單：'+e(d.defaultMatch?'一致':'不一致')+'</span><span>版型定義：'+e(d.definitionMatch?'一致':'不一致')+'</span><span>圖片雜湊：'+e(d.imageShaMatch?'一致':'不一致')+'</span>'}catch(err){document.getElementById('verify-result').textContent='驗證失敗：'+err.message}finally{b.disabled=false}}document.getElementById('publish-button').addEventListener('click',publish);document.getElementById('verify-button').addEventListener('click',verify);load();`;
  return adminPage("rich-menu", "智能圖文選單", "管理客製模板、發布專案與 LINE 線上版本一致性。", content, script);
}

function renderAdminSettingsPage() {
  const content = `<section class="settings-grid"><div class="panel"><div class="eyebrow">CONNECTIONS</div><h2>服務連線</h2><div id="connection-list" class="settings-list">載入中…</div></div><div class="panel"><div class="eyebrow">PUBLIC CONFIG</div><h2>LINE 與 LIFF</h2><div id="config-list" class="settings-list">載入中…</div></div><div class="panel span-two"><div class="eyebrow">ROUTES</div><h2>正式端點</h2><div id="route-list" class="route-list">載入中…</div></div><div class="panel span-two warning-panel"><b>安全原則</b><p>此頁只顯示設定是否存在，不會傳回或顯示任何 Secret 內容。AI 智能判讀目前為規則模式，未啟用外部模型。</p></div></section>`;
  const script = `${commonAdminScript()}const row=(name,ok,note)=>'<div><span><i class="status-dot '+(ok?'ok':'bad')+'"></i>'+e(name)+'</span><b>'+e(note|| (ok?'已設定':'未設定'))+'</b></div>';async function load(){const d=await api('/api/admin/system/status');document.getElementById('connection-list').innerHTML=row('CRM D1',d.database.reachable,'已連線 · '+d.database.contacts+' 位會員')+row('LINE Channel Secret',d.line.channelSecret)+row('LINE Access Token',d.line.accessToken)+row('LINE Login Secret',d.line.loginSecret)+row('Admin Access Key',d.admin.accessKey);document.getElementById('config-list').innerHTML=row('LINE Login Channel ID',Boolean(d.line.loginChannelId),d.line.loginChannelId||'未設定')+row('LIFF ID',Boolean(d.line.liffId),d.line.liffId||'未設定')+row('智能判讀',true,'規則式 · 無外部 AI');document.getElementById('route-list').innerHTML=Object.entries(d.routes).map(x=>'<div><b>'+e(x[0])+'</b><code>'+e(x[1])+'</code><a href="'+e(x[1])+'" target="_blank" rel="noopener">開啟 ↗</a></div>').join('')}load();`;
  return adminPage("settings", "設定區", "確認 Worker、D1、LINE Login、LIFF 與管理端安全設定。", content, script);
}

function page(title, body) {
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#f4f7f6;color:#17332e;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif}a{color:inherit}h1,h2{margin:4px 0 10px}p{line-height:1.6}.eyebrow{font-size:11px;letter-spacing:.15em;color:#4b9580;font-weight:850}.panel{background:#fff;border:1px solid #dce6e3;border-radius:17px;padding:20px;box-shadow:0 8px 28px rgba(20,63,55,.05)}label{display:grid;gap:8px;font-weight:700}input,select,textarea{width:100%;padding:12px;border:1px solid #bfd1cc;border-radius:10px;background:#fff;font:inherit}button,.primary-link{border:0;border-radius:10px;background:#1b6b55;color:#fff;padding:11px 16px;font-weight:800;cursor:pointer;text-decoration:none;display:inline-block}button:disabled{opacity:.55;cursor:wait}.secondary{background:#e5efec;color:#174f43}.error{background:#fff1f1;color:#9b2c2c;padding:10px;border-radius:8px;margin:12px 0}.login{max-width:520px;margin:auto;padding:10vh 20px}.login form{display:grid;gap:14px}.admin-shell{display:grid;grid-template-columns:236px minmax(0,1fr);min-height:100vh}.admin-sidebar{position:sticky;top:0;height:100vh;padding:24px 16px;background:#123d35;color:#dfeee9;display:flex;flex-direction:column}.admin-brand{display:flex;align-items:center;gap:11px;padding:0 9px 24px;text-decoration:none}.admin-brand b{display:block;letter-spacing:.12em}.admin-brand small{display:block;color:#84b6a8;font-size:9px;letter-spacing:.14em}.brand-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#e6c784;color:#133d35;font-size:22px;font-weight:900}.admin-sidebar nav{display:grid;gap:7px}.admin-nav-item{display:flex;align-items:center;gap:12px;padding:12px;border-radius:11px;color:#b9d3cb;text-decoration:none}.admin-nav-item span{width:22px;text-align:center;font-size:18px}.admin-nav-item:hover,.admin-nav-item.active{background:#24594d;color:#fff}.sidebar-foot{margin-top:auto;padding:15px 10px;color:#a6c9bf;font-size:12px}.online-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#38c97c;margin-right:6px}.logout-button{display:block;width:100%;margin-top:14px;background:#244f47;color:#dcebe7}.admin-workspace{min-width:0}.admin-header{display:flex;justify-content:space-between;align-items:center;padding:26px 32px 21px;background:#fff;border-bottom:1px solid #dce6e3}.admin-header h1{font-size:27px}.admin-header p{margin:0;color:#687e77}.public-link{padding:10px 14px;border-radius:9px;background:#edf4f2;color:#175b49;font-weight:750;text-decoration:none;white-space:nowrap}.admin-content{max-width:1440px;margin:auto;padding:24px 30px 40px}.stats,.monitor-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}.stat{background:#fff;border:1px solid #dce6e3;border-radius:15px;padding:17px}.stat strong{display:block;font-size:29px;margin:2px 0}.stat span,.stat small,.muted{color:#657a74}.section-title{display:flex;justify-content:space-between;align-items:center;gap:12px}.text-link{color:#1b6b55;font-weight:800;text-decoration:none;white-space:nowrap}.dashboard-grid{display:grid;grid-template-columns:minmax(0,2fr) minmax(280px,1fr);gap:18px}.menu-overview .menu-preview{margin-bottom:14px}.module-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:18px}.module-card{display:flex;align-items:center;gap:13px;padding:17px;background:#fff;border:1px solid #dce6e3;border-radius:15px;text-decoration:none}.module-card:hover{border-color:#80b6a7;box-shadow:0 8px 22px rgba(20,63,55,.08)}.module-card div{flex:1}.module-card b{display:block}.module-card p{margin:3px 0 0;color:#657a74;font-size:12px;line-height:1.4}.module-icon{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:#e7f1ee;color:#1b6b55;font-size:20px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid #e7eeec;vertical-align:middle}th{font-size:11px;color:#657a74;letter-spacing:.05em}.badge{display:inline-block;padding:4px 8px;border-radius:999px;background:#e5f1ed;color:#175b49;font-size:11px}.menu-preview{display:block;width:100%;aspect-ratio:2500/1686;object-fit:contain;border:3px solid #163f37;border-radius:12px;background:#eef4f2;margin:12px 0}.menu-preview.large{max-height:560px}.menu-status{display:grid;gap:4px;padding:12px;margin:12px 0;border-radius:10px;background:#edf5f2}.menu-status strong{color:#175b49}.menu-status span{font-size:12px;color:#657a74;overflow-wrap:anywhere}.info-strip{padding:11px 14px;margin-bottom:16px;border-radius:11px;background:#eaf4f1;color:#416c60;font-size:13px}.info-strip span:last-child{margin-left:8px}.catalog-tools{display:grid;grid-template-columns:1fr 200px;gap:10px;margin:15px 0}.product-cell{display:flex;align-items:center;gap:10px;min-width:210px}.product-cell img,.product-placeholder{width:52px;height:52px;border-radius:9px;object-fit:cover;background:#e8efed}.product-placeholder{display:grid;place-items:center;color:#1b6b55;font-weight:900}.product-cell small{display:block;color:#657a74;margin-top:3px}.clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-width:240px}.rich-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,1fr);gap:18px}.top-gap{margin-top:18px}.action-row{display:flex;gap:10px;flex-wrap:wrap}.detail-list,.settings-list{display:grid}.detail-list>div,.settings-list>div{display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #e7eeec}.detail-list span,.settings-list span{color:#657a74}.detail-list b,.settings-list b{text-align:right;overflow-wrap:anywhere}.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.span-two{grid-column:span 2}.status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px}.status-dot.ok{background:#28a66c}.status-dot.bad{background:#d65b5b}.route-list{display:grid;gap:9px}.route-list>div{display:grid;grid-template-columns:100px 1fr auto;align-items:center;gap:10px;padding:11px;border-radius:9px;background:#f5f8f7}.route-list code{overflow-wrap:anywhere}.route-list a{color:#1b6b55;font-weight:800;text-decoration:none}.warning-panel{background:#fffaf0;border-color:#ead9ae}.warning-panel p{margin:5px 0;color:#705d34}code{font-size:12px}
@media(max-width:1100px){.module-grid{grid-template-columns:1fr 1fr}.dashboard-grid,.rich-grid{grid-template-columns:1fr}.span-two{grid-column:auto}}
@media(max-width:800px){.admin-shell{grid-template-columns:1fr}.admin-sidebar{position:sticky;z-index:10;height:auto;padding:10px 12px;overflow:auto}.admin-brand,.sidebar-foot{display:none}.admin-sidebar nav{display:flex;min-width:max-content}.admin-nav-item{padding:9px 12px}.admin-nav-item span{display:none}.admin-header{padding:19px 17px}.admin-header h1{font-size:22px}.admin-header p{font-size:13px}.admin-content{padding:16px}.stats,.monitor-stats{grid-template-columns:1fr 1fr}.settings-grid{grid-template-columns:1fr}.catalog-tools{grid-template-columns:1fr}.dashboard-grid{grid-template-columns:1fr}.public-link{display:none}}
@media(max-width:480px){.module-grid{grid-template-columns:1fr}.stat strong{font-size:24px}.admin-header{align-items:flex-start}.section-title{align-items:flex-start}.route-list>div{grid-template-columns:1fr}.span-two{grid-column:auto}}
.dashboard-grid>.span-two{grid-column:auto}
</style></head><body>${body}</body></html>`;
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
