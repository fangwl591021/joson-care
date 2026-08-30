PRAGMA foreign_keys = ON;

ALTER TABLE rich_menu_templates ADD COLUMN definition_json TEXT;
ALTER TABLE rich_menu_templates ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rich_menu_templates ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'verified';

ALTER TABLE rich_menu_projects ADD COLUMN alias_id TEXT;
ALTER TABLE rich_menu_projects ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;

ALTER TABLE rich_menu_versions ADD COLUMN project_id TEXT REFERENCES rich_menu_projects(id) ON DELETE SET NULL;

UPDATE rich_menu_templates
SET definition_json = COALESCE(
  definition_json,
  (SELECT d.definition_json
   FROM rich_menu_projects p
   JOIN rich_menu_project_drafts d ON d.project_id = p.id
   WHERE p.template_id = rich_menu_templates.id
   ORDER BY d.updated_at DESC
   LIMIT 1),
  '{"name":"Joson 客製智慧照護選單 v1","chatBarText":"Joson 智慧服務","selected":true,"size":{"width":2500,"height":1686},"areas":[]}'
);

UPDATE rich_menu_projects
SET alias_id = CASE
  WHEN id = 'joson-care-default' THEN 'joson-care-default'
  ELSE 'joson-' || lower(substr(replace(id, '-', ''), 1, 24))
END
WHERE alias_id IS NULL;

UPDATE rich_menu_projects
SET is_default = CASE WHEN id = 'joson-care-default' THEN 1 ELSE 0 END;

UPDATE rich_menu_versions
SET project_id = (
  SELECT p.id FROM rich_menu_projects p WHERE p.current_version_id = rich_menu_versions.id LIMIT 1
)
WHERE project_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_rich_menu_versions_project
  ON rich_menu_versions(project_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rich_menu_projects_alias
  ON rich_menu_projects(alias_id);

CREATE INDEX IF NOT EXISTS idx_rich_menu_projects_default
  ON rich_menu_projects(is_default DESC, updated_at DESC);
