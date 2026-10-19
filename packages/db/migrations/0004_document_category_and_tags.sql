ALTER TABLE documents ADD COLUMN category TEXT;
ALTER TABLE documents ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
CREATE INDEX documents_category_idx ON documents(category);
