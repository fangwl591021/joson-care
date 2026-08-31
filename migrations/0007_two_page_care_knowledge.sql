PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO rich_menu_templates
  (id, name, description, width, height, layout_json, default_image_path, status, created_at, updated_at, definition_json, revision, verification_status)
VALUES
  ('joson-two-page-main-v3', 'Joson 雙頁選單｜智慧服務', '上方雙頁籤切換；智慧顧問、全系列產品、社群、產品教學與服務入口。', 2500, 1686,
   '{"kind":"two_page_main","tabs":["joson-care-main","joson-care-knowledge"],"primaryArea":"advisor"}',
   '/assets/rich-menu/joson-care-main-v3.png', 'active', datetime('now'), datetime('now'),
   '{"name":"Joson 智慧服務雙頁選單 v3","chatBarText":"Joson 智慧服務","selected":true,"size":{"width":2500,"height":1686},"areas":[{"bounds":{"x":1250,"y":0,"width":1250,"height":240},"action":{"type":"richmenuswitch","label":"切換照護知識","richMenuAliasId":"joson-care-knowledge","targetProjectId":"joson-care-knowledge-v3","data":"switch=joson-care-knowledge"}},{"bounds":{"x":0,"y":240,"width":980,"height":1446},"action":{"type":"postback","label":"智慧選床顧問","data":"action=ai_select&source=rich_menu_default","displayText":"智慧選床顧問"}},{"bounds":{"x":980,"y":240,"width":1520,"height":530},"action":{"type":"postback","label":"全系列產品","data":"action=all_products&source=rich_menu_default","displayText":"全系列產品"}},{"bounds":{"x":1015,"y":780,"width":460,"height":165},"action":{"type":"uri","label":"Facebook","uri":"https://www.facebook.com/JosonCare"}},{"bounds":{"x":1490,"y":780,"width":505,"height":165},"action":{"type":"uri","label":"YouTube 產品使用教學","uri":"https://liff.line.me/2011335134-ccbJ33yx/videos?category=tutorial"}},{"bounds":{"x":2010,"y":780,"width":455,"height":165},"action":{"type":"uri","label":"LinkedIn","uri":"https://www.linkedin.com/company/joson-care/"}},{"bounds":{"x":995,"y":975,"width":365,"height":711},"action":{"type":"postback","label":"床型比較","data":"action=compare&source=rich_menu_default","displayText":"床型比較"}},{"bounds":{"x":1368,"y":975,"width":365,"height":711},"action":{"type":"uri","label":"產品使用教學","uri":"https://liff.line.me/2011335134-ccbJ33yx/videos?category=tutorial"}},{"bounds":{"x":1741,"y":975,"width":365,"height":711},"action":{"type":"postback","label":"售後服務","data":"action=after_sales&source=rich_menu_default","displayText":"售後服務"}},{"bounds":{"x":2114,"y":975,"width":365,"height":711},"action":{"type":"postback","label":"專人諮詢","data":"action=contact&source=rich_menu_default","displayText":"專人諮詢"}}]}', 1, 'verified'),
  ('joson-two-page-knowledge-v3', 'Joson 雙頁選單｜照護知識', '照護知識總覽、防跌、中風長期臥床、失智、操作保養與補助入口。', 2500, 1686,
   '{"kind":"two_page_knowledge","tabs":["joson-care-main","joson-care-knowledge"],"primaryArea":"care_guide"}',
   '/assets/rich-menu/joson-care-knowledge-v3.png', 'active', datetime('now'), datetime('now'),
   '{"name":"Joson 照護知識雙頁選單 v3","chatBarText":"Joson 照護知識","selected":false,"size":{"width":2500,"height":1686},"areas":[{"bounds":{"x":0,"y":0,"width":1250,"height":240},"action":{"type":"richmenuswitch","label":"切換智慧服務","richMenuAliasId":"joson-care-main","targetProjectId":"joson-care-main-v3","data":"switch=joson-care-main"}},{"bounds":{"x":0,"y":240,"width":960,"height":1446},"action":{"type":"uri","label":"照護知識專區","uri":"https://joson-care.fangwl591021.workers.dev/care"}},{"bounds":{"x":965,"y":270,"width":740,"height":395},"action":{"type":"uri","label":"防跌與居家安全","uri":"https://joson-care.fangwl591021.workers.dev/care/fall-prevention"}},{"bounds":{"x":1725,"y":270,"width":740,"height":395},"action":{"type":"uri","label":"中風與長期臥床","uri":"https://joson-care.fangwl591021.workers.dev/care/bedridden-stroke"}},{"bounds":{"x":965,"y":685,"width":740,"height":395},"action":{"type":"uri","label":"失智症居家照護","uri":"https://joson-care.fangwl591021.workers.dev/care/dementia-care"}},{"bounds":{"x":1725,"y":685,"width":740,"height":395},"action":{"type":"uri","label":"照護床操作與保養","uri":"https://joson-care.fangwl591021.workers.dev/care/bed-operation-maintenance"}},{"bounds":{"x":965,"y":1100,"width":1500,"height":542},"action":{"type":"uri","label":"長照輔具與醫療床補助","uri":"https://joson-care.fangwl591021.workers.dev/subsidy"}}]}', 1, 'verified');

INSERT OR IGNORE INTO rich_menu_projects
  (id, name, template_id, audience_stage, status, created_at, updated_at, alias_id, is_default)
VALUES
  ('joson-care-main-v3', 'Joson-Care 智慧服務主選單 v3', 'joson-two-page-main-v3', 'default', 'draft', datetime('now'), datetime('now'), 'joson-care-main', 1),
  ('joson-care-knowledge-v3', 'Joson-Care 照護知識選單 v3', 'joson-two-page-knowledge-v3', 'knowledge', 'draft', datetime('now'), datetime('now'), 'joson-care-knowledge', 0);

UPDATE rich_menu_projects SET is_default = CASE WHEN id = 'joson-care-main-v3' THEN 1 ELSE 0 END;

INSERT OR IGNORE INTO rich_menu_project_drafts
  (project_id, definition_json, image_path, revision, created_at, updated_at)
SELECT p.id, t.definition_json, t.default_image_path, 1, datetime('now'), datetime('now')
FROM rich_menu_projects p
JOIN rich_menu_templates t ON t.id = p.template_id
WHERE p.id IN ('joson-care-main-v3', 'joson-care-knowledge-v3');
