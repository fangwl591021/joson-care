PRAGMA foreign_keys = ON;

UPDATE rich_menu_templates
SET name = 'Joson 雙頁選單｜照護知識 v6',
    description = '所有照護知識按鈕直接開啟 Joson-Care 官網完整文章。',
    definition_json = json_set(
      definition_json,
      '$.name', 'Joson 照護知識雙頁選單 v6',
      '$.areas[1].action.uri', 'https://www.joson-care.com/article.php?lang=tw&tb=9&cid=17',
      '$.areas[2].action.uri', 'https://www.joson-care.com/article_d.php?id=542&lang=tw&tb=4',
      '$.areas[3].action.uri', 'https://www.joson-care.com/article_d.php?id=465&lang=tw&tb=4',
      '$.areas[4].action.uri', 'https://www.joson-care.com/article_d.php?id=455&lang=tw&tb=4',
      '$.areas[5].action.uri', 'https://www.joson-care.com/article_d.php?id=303&lang=tw&tb=4',
      '$.areas[6].action.uri', 'https://www.joson-care.com/article_d.php?id=313&lang=tw&tb=4'
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
