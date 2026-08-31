PRAGMA foreign_keys = ON;

UPDATE rich_menu_templates
SET name = 'Joson 雙頁選單｜照護知識 v7',
    description = '官網完整照護文章統一由 LIFF TALL 開啟，保留 LINE 內快速關閉體驗。',
    definition_json = json_set(
      definition_json,
      '$.name', 'Joson 照護知識雙頁選單 v7',
      '$.areas[1].action.uri', 'https://liff.line.me/2011335134-ccbJ33yx/knowledge?topic=overview',
      '$.areas[2].action.uri', 'https://liff.line.me/2011335134-ccbJ33yx/knowledge?topic=fall',
      '$.areas[3].action.uri', 'https://liff.line.me/2011335134-ccbJ33yx/knowledge?topic=stroke',
      '$.areas[4].action.uri', 'https://liff.line.me/2011335134-ccbJ33yx/knowledge?topic=dementia',
      '$.areas[5].action.uri', 'https://liff.line.me/2011335134-ccbJ33yx/knowledge?topic=maintenance',
      '$.areas[6].action.uri', 'https://liff.line.me/2011335134-ccbJ33yx/knowledge?topic=subsidy'
    ),
    revision = revision + 1,
    updated_at = datetime('now')
WHERE id = 'joson-two-page-knowledge-v3';

UPDATE rich_menu_project_drafts
SET definition_json = (SELECT definition_json FROM rich_menu_templates WHERE id = 'joson-two-page-knowledge-v3'),
    revision = revision + 1,
    updated_at = datetime('now')
WHERE project_id = 'joson-care-knowledge-v3';

UPDATE rich_menu_projects
SET status = 'draft', updated_at = datetime('now')
WHERE id = 'joson-care-knowledge-v3';
