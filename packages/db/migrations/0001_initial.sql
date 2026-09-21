CREATE TABLE browser_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT
);
CREATE TABLE browser_profile_hosts (
  profile_id TEXT NOT NULL REFERENCES browser_profiles(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  PRIMARY KEY (profile_id, hostname)
);
CREATE TABLE translation_jobs (
  id TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  target_language TEXT NOT NULL,
  browser_profile_id TEXT REFERENCES browser_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  options TEXT NOT NULL DEFAULT '{}',
  error_code TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE INDEX jobs_status_created_idx ON translation_jobs(status, created_at);
CREATE TABLE fetch_attempts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES translation_jobs(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  outcome TEXT NOT NULL,
  http_status INTEGER,
  error_code TEXT,
  error TEXT,
  snapshot_path TEXT,
  content_hash TEXT,
  byte_length INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX fetch_job_idx ON fetch_attempts(job_id);
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE REFERENCES translation_jobs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  translated_title TEXT,
  source_language TEXT,
  document_ast TEXT NOT NULL,
  extraction_confidence REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE segments (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  stable_key TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  node_type TEXT NOT NULL,
  source_text TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  translatable INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX segments_document_key_idx ON segments(document_id, stable_key);
CREATE INDEX segments_source_hash_idx ON segments(source_hash);
CREATE TABLE translation_runs (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES translation_jobs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT,
  strategy TEXT NOT NULL,
  character_count INTEGER NOT NULL,
  duration_ms INTEGER,
  outcome TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE translations (
  id TEXT PRIMARY KEY,
  segment_id TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  target_language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  quality_status TEXT NOT NULL DEFAULT 'unreviewed',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX translation_segment_language_idx ON translations(segment_id, target_language);
