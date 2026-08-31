PRAGMA foreign_keys = ON;

UPDATE rich_menu_templates
SET name = 'Joson 雙頁選單｜照護知識 v8',
    description = '官網完整照護文章使用獨立 LIFF TALL 開啟，不影響影音與分享功能。',
    definition_json = json_set(
      definition_json,
      '$.name', 'Joson 照護知識雙頁選單 v8',
      '$.areas[1].action.uri', 'https://liff.line.me/2011335134-vQ4CQiOV?topic=overview',
      '$.areas[2].action.uri', 'https://liff.line.me/2011335134-vQ4CQiOV?topic=fall',
      '$.areas[3].action.uri', 'https://liff.line.me/2011335134-vQ4CQiOV?topic=stroke',
      '$.areas[4].action.uri', 'https://liff.line.me/2011335134-vQ4CQiOV?topic=dementia',
      '$.areas[5].action.uri', 'https://liff.line.me/2011335134-vQ4CQiOV?topic=maintenance',
      '$.areas[6].action.uri', 'https://liff.line.me/2011335134-vQ4CQiOV?topic=subsidy'
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
