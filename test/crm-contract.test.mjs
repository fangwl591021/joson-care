import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { DEFAULT_RICH_MENU, monitorPriorityForIntent, postbackToText } from "../crm.js";

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
