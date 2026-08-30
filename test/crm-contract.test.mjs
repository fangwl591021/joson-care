import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_RICH_MENU, postbackToText } from "../crm.js";

test("default Rich Menu has six valid postback areas", () => {
  assert.deepEqual(DEFAULT_RICH_MENU.size, { width: 2500, height: 1686 });
  assert.equal(DEFAULT_RICH_MENU.areas.length, 6);
  for (const area of DEFAULT_RICH_MENU.areas) {
    assert.equal(area.action.type, "postback");
    assert.match(area.action.data, /source=rich_menu_default/);
    assert.ok(area.bounds.x >= 0 && area.bounds.y >= 0);
    assert.ok(area.bounds.x + area.bounds.width <= DEFAULT_RICH_MENU.size.width);
    assert.ok(area.bounds.y + area.bounds.height <= DEFAULT_RICH_MENU.size.height);
  }
});

test("Rich Menu actions route into existing conversation commands", () => {
  assert.equal(postbackToText("action=ai_select&source=rich_menu_default"), "AI選床");
  assert.equal(postbackToText("action=featured_products&source=rich_menu_default"), "居家照護床");
  assert.equal(postbackToText("action=all_products&source=rich_menu_default"), "產品總覽");
  assert.equal(postbackToText("action=compare&source=rich_menu_default"), "床型比較");
  assert.equal(postbackToText("action=after_sales&source=rich_menu_default"), "售後服務");
  assert.equal(postbackToText("action=contact&source=rich_menu_default"), "請專人聯絡");
});
