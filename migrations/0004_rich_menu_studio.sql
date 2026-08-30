PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rich_menu_project_drafts (
  project_id TEXT PRIMARY KEY,
  definition_json TEXT NOT NULL,
  image_path TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES rich_menu_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rich_menu_drafts_updated
  ON rich_menu_project_drafts(updated_at DESC);

INSERT OR IGNORE INTO rich_menu_project_drafts
  (project_id, definition_json, image_path, revision, created_at, updated_at)
SELECT
  p.id,
  COALESCE(v.definition_json,
    '{"name":"Joson 客製智慧照護選單 v1","chatBarText":"Joson 智慧服務","selected":true,"size":{"width":2500,"height":1686},"areas":[]}'),
  COALESCE(v.image_path, t.default_image_path, '/assets/rich-menu/joson-care-custom-v1.png'),
  1,
  datetime('now'),
  datetime('now')
FROM rich_menu_projects p
JOIN rich_menu_templates t ON t.id = p.template_id
LEFT JOIN rich_menu_versions v ON v.id = p.current_version_id;
