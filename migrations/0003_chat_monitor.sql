PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crm_thread_monitor_state (
  thread_id TEXT PRIMARY KEY,
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
  assigned_to TEXT,
  last_intent TEXT,
  last_product_model TEXT,
  analysis_mode TEXT NOT NULL DEFAULT 'rule_based' CHECK (analysis_mode IN ('rule_based', 'external_ai')),
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES crm_threads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crm_monitor_priority
  ON crm_thread_monitor_state(priority DESC, updated_at DESC);

INSERT OR IGNORE INTO crm_thread_monitor_state
  (thread_id, priority, last_intent, last_product_model, analysis_mode, created_at, updated_at)
SELECT
  t.id,
  CASE latest.intent
    WHEN 'contact_request' THEN 3
    WHEN 'procurement' THEN 3
    WHEN 'after_sales' THEN 2
    WHEN 'low_bed' THEN 1
    WHEN 'space_saving' THEN 1
    WHEN 'four_rail' THEN 1
    WHEN 'professional_controls' THEN 1
    WHEN 'start_advisor' THEN 1
    WHEN 'compare_products' THEN 1
    WHEN 'browse_products' THEN 1
    ELSE 0
  END,
  latest.intent,
  latest.product_model,
  'rule_based',
  datetime('now'),
  datetime('now')
FROM crm_threads t
LEFT JOIN crm_events latest ON latest.id = (
  SELECT e.id FROM crm_events e
  WHERE e.contact_id = t.contact_id
  ORDER BY e.occurred_at DESC
  LIMIT 1
);
