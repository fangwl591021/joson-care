PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rich_menu_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  layout_json TEXT NOT NULL,
  default_image_path TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rich_menu_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  template_id TEXT NOT NULL,
  audience_stage TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'publishing', 'published', 'failed', 'archived')),
  current_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (template_id) REFERENCES rich_menu_templates(id) ON DELETE RESTRICT,
  FOREIGN KEY (current_version_id) REFERENCES rich_menu_versions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS rich_menu_publish_runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  version_id TEXT,
  previous_line_rich_menu_id TEXT,
  new_line_rich_menu_id TEXT,
  stage TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY (project_id) REFERENCES rich_menu_projects(id) ON DELETE CASCADE,
  FOREIGN KEY (version_id) REFERENCES rich_menu_versions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_rich_menu_projects_status ON rich_menu_projects(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_rich_menu_publish_runs_project ON rich_menu_publish_runs(project_id, started_at DESC);

INSERT OR IGNORE INTO rich_menu_templates
  (id, name, description, width, height, layout_json, default_image_path, status, created_at, updated_at)
VALUES
  ('joson-custom-asymmetric-v1', 'Joson 客製不對稱智慧選單',
   '大型智慧選床入口、四款產品實圖與四個服務捷徑，不使用制式六宮格。',
   2500, 1686,
   '{"kind":"custom_asymmetric","primaryArea":"advisor","featuredArea":"home_care_products","serviceRail":["catalog","compare","after_sales","contact"]}',
   '/assets/rich-menu/joson-care-custom-v1.png', 'active', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO rich_menu_projects
  (id, name, template_id, audience_stage, status, created_at, updated_at)
VALUES
  ('joson-care-default', 'Joson-Care 預設智能圖文選單', 'joson-custom-asymmetric-v1', 'default', 'draft', datetime('now'), datetime('now'));
