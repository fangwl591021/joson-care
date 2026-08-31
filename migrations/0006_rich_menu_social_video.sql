PRAGMA foreign_keys = ON;

UPDATE rich_menu_templates
SET name = 'Joson 溫馨照護社群選單',
    description = '人物照護主視覺、居家照護床、Facebook／YouTube／LinkedIn 與四個服務捷徑。',
    layout_json = '{"kind":"custom_asymmetric_social","primaryArea":"advisor","socialRail":["facebook","youtube_liff","linkedin"],"serviceRail":["catalog","compare","after_sales","contact"]}',
    default_image_path = '/assets/rich-menu/joson-care-social-v2.png',
    definition_json = '{"name":"Joson 溫馨照護社群選單 v2","chatBarText":"Joson 智慧服務","selected":true,"size":{"width":2500,"height":1686},"areas":[{"bounds":{"x":0,"y":0,"width":1030,"height":1686},"action":{"type":"postback","label":"智慧選床顧問","data":"action=ai_select&source=rich_menu_default","displayText":"智慧選床顧問"}},{"bounds":{"x":1090,"y":760,"width":430,"height":180},"action":{"type":"uri","label":"Facebook","uri":"https://www.facebook.com/JosonCare"}},{"bounds":{"x":1535,"y":760,"width":420,"height":180},"action":{"type":"uri","label":"YouTube 影音頻道","uri":"https://liff.line.me/2011335134-ccbJ33yx/videos"}},{"bounds":{"x":1975,"y":760,"width":445,"height":180},"action":{"type":"uri","label":"LinkedIn","uri":"https://www.linkedin.com/company/joson-care/"}},{"bounds":{"x":1030,"y":970,"width":383,"height":716},"action":{"type":"postback","label":"全系列產品","data":"action=all_products&source=rich_menu_default","displayText":"全系列產品"}},{"bounds":{"x":1413,"y":970,"width":362,"height":716},"action":{"type":"postback","label":"床型比較","data":"action=compare&source=rich_menu_default","displayText":"床型比較"}},{"bounds":{"x":1775,"y":970,"width":363,"height":716},"action":{"type":"postback","label":"售後服務","data":"action=after_sales&source=rich_menu_default","displayText":"售後服務"}},{"bounds":{"x":2138,"y":970,"width":362,"height":716},"action":{"type":"postback","label":"專人諮詢","data":"action=contact&source=rich_menu_default","displayText":"專人諮詢"}}]}',
    revision = revision + 1,
    verification_status = 'verified',
    updated_at = datetime('now')
WHERE id = 'joson-custom-asymmetric-v1';

UPDATE rich_menu_project_drafts
SET definition_json = (SELECT definition_json FROM rich_menu_templates WHERE id = 'joson-custom-asymmetric-v1'),
    image_path = '/assets/rich-menu/joson-care-social-v2.png',
    revision = revision + 1,
    updated_at = datetime('now')
WHERE project_id = 'joson-care-default';

UPDATE rich_menu_projects
SET status = 'draft', updated_at = datetime('now')
WHERE id = 'joson-care-default';
