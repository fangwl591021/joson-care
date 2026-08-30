PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS crm_contacts (
  id TEXT PRIMARY KEY,
  line_user_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  picture_url TEXT,
  friend_status TEXT NOT NULL DEFAULT 'active' CHECK (friend_status IN ('active', 'blocked', 'unknown')),
  lifecycle_stage TEXT NOT NULL DEFAULT 'new' CHECK (lifecycle_stage IN ('new', 'selecting', 'lead', 'customer', 'after_sales', 'inactive')),
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_message_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_last_seen ON crm_contacts(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_stage ON crm_contacts(lifecycle_stage, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS crm_threads (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message_preview TEXT,
  last_message_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crm_threads_activity ON crm_threads(last_message_at DESC);

CREATE TABLE IF NOT EXISTS crm_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  line_event_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL,
  text_content TEXT,
  payload_summary TEXT,
  sent_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES crm_threads(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_messages_line_event ON crm_messages(line_event_id) WHERE line_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_messages_thread_time ON crm_messages(thread_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS crm_events (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  contact_id TEXT,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'line',
  intent TEXT,
  product_model TEXT,
  metadata_json TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_events_contact_time ON crm_events(contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_events_type_time ON crm_events(event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS crm_tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#1B6B55',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_contact_tags (
  contact_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (contact_id, tag_id),
  FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES crm_tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS crm_leads (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacting', 'qualified', 'quoted', 'won', 'lost')),
  source TEXT NOT NULL DEFAULT 'line',
  need_summary TEXT,
  recommended_model TEXT,
  contact_name TEXT,
  phone TEXT,
  region TEXT,
  assigned_to TEXT,
  next_follow_up_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_contact ON crm_leads(contact_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS crm_notes (
  id TEXT PRIMARY KEY,
  contact_id TEXT NOT NULL,
  author TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crm_notes_contact_time ON crm_notes(contact_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rich_menu_versions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  audience_stage TEXT NOT NULL DEFAULT 'default',
  line_rich_menu_id TEXT,
  alias_id TEXT,
  definition_json TEXT NOT NULL,
  image_path TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'uploaded', 'active', 'retired', 'failed')),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rich_menu_assignments (
  contact_id TEXT PRIMARY KEY,
  rich_menu_version_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (rich_menu_version_id) REFERENCES rich_menu_versions(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_time ON admin_audit_logs(created_at DESC);

INSERT OR IGNORE INTO crm_tags (id, name, color, created_at) VALUES
  ('tag_low_bed', '低床需求', '#276749', datetime('now')),
  ('tag_space_saving', '空間有限', '#2B6CB0', datetime('now')),
  ('tag_four_rail', '四片護欄', '#805AD5', datetime('now')),
  ('tag_professional', '完整操作', '#B7791F', datetime('now')),
  ('tag_procurement', '機構採購', '#C53030', datetime('now')),
  ('tag_after_sales', '售後服務', '#4A5568', datetime('now')),
  ('tag_contact_request', '要求聯絡', '#D53F8C', datetime('now'));
