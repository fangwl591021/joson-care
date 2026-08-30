import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { DEFAULT_RICH_MENU, monitorPriorityForIntent, postbackToText, validateRichMenuDefinition } from "../crm.js";

test("custom Rich Menu uses an asymmetric primary area and valid postbacks", () => {
  assert.deepEqual(DEFAULT_RICH_MENU.size, { width: 2500, height: 1686 });
  assert.equal(DEFAULT_RICH_MENU.areas.length, 6);
  assert.deepEqual(DEFAULT_RICH_MENU.areas[0].bounds, { x: 0, y: 0, width: 1030, height: 1686 });
  assert.deepEqual(DEFAULT_RICH_MENU.areas[1].bounds, { x: 1030, y: 0, width: 1470, height: 970 });
  assert.ok(DEFAULT_RICH_MENU.areas[0].bounds.width > DEFAULT_RICH_MENU.areas[2].bounds.width * 2);
  for (const area of DEFAULT_RICH_MENU.areas) {
    assert.equal(area.action.type, "postback");
    assert.match(area.action.data, /source=rich_menu_default/);
    assert.ok(area.bounds.x >= 0 && area.bounds.y >= 0);
    assert.ok(area.bounds.x + area.bounds.width <= DEFAULT_RICH_MENU.size.width);
    assert.ok(area.bounds.y + area.bounds.height <= DEFAULT_RICH_MENU.size.height);
  }
});

test("custom Rich Menu PNG meets LINE dimensions and file-size limit", () => {
  const image = fs.readFileSync(new URL("../public/assets/rich-menu/joson-care-custom-v1.png", import.meta.url));
  assert.equal(image.toString("ascii", 1, 4), "PNG");
  assert.equal(image.readUInt32BE(16), 2500);
  assert.equal(image.readUInt32BE(20), 1686);
  assert.ok(image.byteLength > 0 && image.byteLength <= 1_000_000);
});

test("Rich Menu actions route into existing conversation commands", () => {
  assert.equal(postbackToText("action=ai_select&source=rich_menu_default"), "AI選床");
  assert.equal(postbackToText("action=featured_products&source=rich_menu_default"), "居家照護床");
  assert.equal(postbackToText("action=all_products&source=rich_menu_default"), "產品總覽");
  assert.equal(postbackToText("action=compare&source=rich_menu_default"), "床型比較");
  assert.equal(postbackToText("action=after_sales&source=rich_menu_default"), "售後服務");
  assert.equal(postbackToText("action=contact&source=rich_menu_default"), "請專人聯絡");
});

test("chat monitor prioritizes actionable CRM intents", () => {
  assert.equal(monitorPriorityForIntent("contact_request"), 3);
  assert.equal(monitorPriorityForIntent("procurement"), 3);
  assert.equal(monitorPriorityForIntent("after_sales"), 2);
  assert.equal(monitorPriorityForIntent("low_bed"), 1);
  assert.equal(monitorPriorityForIntent("general_message"), 0);
});

test("admin includes protected AI chat monitoring routes", () => {
  const source = fs.readFileSync(new URL("../crm.js", import.meta.url), "utf8");
  assert.match(source, /\/admin\/chat-monitor/);
  assert.match(source, /\/api\/admin\/chat\/threads/);
  assert.match(source, /\/api\/admin\/chat\/insights/);
  assert.match(source, /規則引擎即時判讀/);
  for (const route of ["/admin/crm", "/admin/products", "/admin/rich-menu", "/admin/settings"]) {
    assert.match(source, new RegExp(route.replaceAll("/", "\\/")));
  }
  for (const section of ["總覽", "CRM", "商品區", "圖文選單", "設定區"]) {
    assert.match(source, new RegExp(section));
  }
});

test("Rich Menu Studio validates editable draft definitions", () => {
  const draft = structuredClone(DEFAULT_RICH_MENU);
  draft.name = "Joson Studio draft";
  draft.areas[0].action.displayText = "開始選床";
  assert.equal(validateRichMenuDefinition(draft).areas.length, 6);

  const overlap = structuredClone(draft);
  overlap.areas[1].bounds.x = 100;
  assert.throws(() => validateRichMenuDefinition(overlap), /互相重疊/);
});

test("Rich Menu Studio exposes template, project, draft and version modules", () => {
  const source = fs.readFileSync(new URL("../crm.js", import.meta.url), "utf8");
  const studio = fs.readFileSync(new URL("../public/admin-rich-menu-studio.js", import.meta.url), "utf8");
  const combined = `${source}\n${studio}`;
  assert.match(source, /\/api\/admin\/rich-menu\/studio/);
  assert.match(source, /rich_menu_project_drafts/);
  for (const route of ["projects/from-template", "upload-image", "set-default", "templates"] ) {
    assert.match(source, new RegExp(route));
  }
  for (const label of ["模板中心", "圖文選單專案", "內容設定", "切換頁", "版本紀錄", "上架紀錄", "發布圖文選單"]) {
    assert.match(combined, new RegExp(label));
  }
});

test("full Studio stores uploaded images in R2 and preserves a safe publish workflow", () => {
  const source = fs.readFileSync(new URL("../crm.js", import.meta.url), "utf8");
  const config = fs.readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
  assert.match(config, /RICH_MENU_ASSETS/);
  assert.match(source, /RICH_MENU_ASSETS\.put/);
  assert.match(source, /upsertRichMenuAlias/);
  assert.match(source, /verifyDefaultRichMenu/);
  assert.match(source, /cleanupOldRichMenu/);
  assert.ok(source.indexOf("verifyDefaultRichMenu") < source.indexOf("cleanupOldRichMenu"));
});
