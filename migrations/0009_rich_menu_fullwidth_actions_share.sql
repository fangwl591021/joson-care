PRAGMA foreign_keys = ON;

UPDATE rich_menu_templates
SET name = 'Joson 雙頁選單｜智慧服務 v5',
    description = '底部五個全寬大按鈕，新增 LIFF 分享好友，並全面放大必要文字。',
    default_image_path = '/assets/rich-menu/joson-care-main-v5.png',
    definition_json = json_insert(
      json_set(
        definition_json,
        '$.name', 'Joson 智慧服務雙頁選單 v5',
        '$.areas[1].bounds.x', 0, '$.areas[1].bounds.y', 240, '$.areas[1].bounds.width', 980, '$.areas[1].bounds.height', 760,
        '$.areas[6].bounds.x', 0, '$.areas[6].bounds.y', 1000, '$.areas[6].bounds.width', 500, '$.areas[6].bounds.height', 686,
        '$.areas[7].bounds.x', 500, '$.areas[7].bounds.y', 1000, '$.areas[7].bounds.width', 500, '$.areas[7].bounds.height', 686,
        '$.areas[8].bounds.x', 1000, '$.areas[8].bounds.y', 1000, '$.areas[8].bounds.width', 500, '$.areas[8].bounds.height', 686,
        '$.areas[9].bounds.x', 1500, '$.areas[9].bounds.y', 1000, '$.areas[9].bounds.width', 500, '$.areas[9].bounds.height', 686
      ),
      '$.areas[#]',
      json('{"bounds":{"x":2000,"y":1000,"width":500,"height":686},"action":{"type":"uri","label":"分享好友","uri":"https://liff.line.me/2011335134-ccbJ33yx/share"}}')
    ),
    revision = revision + 1,
    updated_at = datetime('now')
WHERE id = 'joson-two-page-main-v3';

UPDATE rich_menu_templates
SET name = 'Joson 雙頁選單｜照護知識 v5',
    description = '移除不必要的小字並放大所有主要標題，維持人物圖不被文字遮擋。',
    default_image_path = '/assets/rich-menu/joson-care-knowledge-v5.png',
    definition_json = json_set(definition_json, '$.name', 'Joson 照護知識雙頁選單 v5'),
    revision = revision + 1,
    updated_at = datetime('now')
WHERE id = 'joson-two-page-knowledge-v3';

UPDATE rich_menu_project_drafts
SET definition_json = (SELECT definition_json FROM rich_menu_templates WHERE id = 'joson-two-page-main-v3'),
    image_path = '/assets/rich-menu/joson-care-main-v5.png',
    revision = revision + 1,
    updated_at = datetime('now')
WHERE project_id = 'joson-care-main-v3';

UPDATE rich_menu_project_drafts
SET definition_json = (SELECT definition_json FROM rich_menu_templates WHERE id = 'joson-two-page-knowledge-v3'),
    image_path = '/assets/rich-menu/joson-care-knowledge-v5.png',
    revision = revision + 1,
    updated_at = datetime('now')
WHERE project_id = 'joson-care-knowledge-v3';

UPDATE rich_menu_projects
SET status = 'draft', updated_at = datetime('now')
WHERE id IN ('joson-care-main-v3', 'joson-care-knowledge-v3');
