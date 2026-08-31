PRAGMA foreign_keys = ON;

UPDATE rich_menu_templates
SET name = 'Joson 雙頁選單｜智慧服務 v4',
    description = '手機可讀大字版；移除人物與產品區的大面積半透明遮罩。',
    default_image_path = '/assets/rich-menu/joson-care-main-v4.png',
    definition_json = json_set(definition_json, '$.name', 'Joson 智慧服務雙頁選單 v4'),
    revision = revision + 1,
    updated_at = datetime('now')
WHERE id = 'joson-two-page-main-v3';

UPDATE rich_menu_templates
SET name = 'Joson 雙頁選單｜照護知識 v4',
    description = '手機可讀大字版；依底圖原生三欄卡位重排，不使用重複遮罩。',
    default_image_path = '/assets/rich-menu/joson-care-knowledge-v4.png',
    definition_json = json_set(
      definition_json,
      '$.name', 'Joson 照護知識雙頁選單 v4',
      '$.areas[2].bounds.x', 965, '$.areas[2].bounds.y', 245, '$.areas[2].bounds.width', 485, '$.areas[2].bounds.height', 465,
      '$.areas[3].bounds.x', 1470, '$.areas[3].bounds.y', 245, '$.areas[3].bounds.width', 485, '$.areas[3].bounds.height', 465,
      '$.areas[4].bounds.x', 1980, '$.areas[4].bounds.y', 245, '$.areas[4].bounds.width', 485, '$.areas[4].bounds.height', 465,
      '$.areas[5].bounds.x', 965, '$.areas[5].bounds.y', 735, '$.areas[5].bounds.width', 1500, '$.areas[5].bounds.height', 540,
      '$.areas[6].bounds.x', 965, '$.areas[6].bounds.y', 1275, '$.areas[6].bounds.width', 1500, '$.areas[6].bounds.height', 411
    ),
    revision = revision + 1,
    updated_at = datetime('now')
WHERE id = 'joson-two-page-knowledge-v3';

UPDATE rich_menu_project_drafts
SET definition_json = (SELECT definition_json FROM rich_menu_templates WHERE id = 'joson-two-page-main-v3'),
    image_path = '/assets/rich-menu/joson-care-main-v4.png',
    revision = revision + 1,
    updated_at = datetime('now')
WHERE project_id = 'joson-care-main-v3';

UPDATE rich_menu_project_drafts
SET definition_json = (SELECT definition_json FROM rich_menu_templates WHERE id = 'joson-two-page-knowledge-v3'),
    image_path = '/assets/rich-menu/joson-care-knowledge-v4.png',
    revision = revision + 1,
    updated_at = datetime('now')
WHERE project_id = 'joson-care-knowledge-v3';

UPDATE rich_menu_projects
SET status = 'draft', updated_at = datetime('now')
WHERE id IN ('joson-care-main-v3', 'joson-care-knowledge-v3');
