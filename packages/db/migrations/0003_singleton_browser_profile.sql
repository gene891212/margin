ALTER TABLE translation_jobs ADD COLUMN use_browser_profile INTEGER NOT NULL DEFAULT 0;
UPDATE translation_jobs SET use_browser_profile = 1 WHERE browser_profile_id IS NOT NULL;
ALTER TABLE translation_jobs DROP COLUMN browser_profile_id;

CREATE TABLE browser_profile (
  id TEXT PRIMARY KEY DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT
);

INSERT OR IGNORE INTO browser_profile (id, status, created_at, last_used_at)
SELECT 'default', status, created_at, last_used_at FROM browser_profiles LIMIT 1;

DROP TABLE IF EXISTS browser_profiles;
