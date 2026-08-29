-- 01-init-extensions.sql
-- Source: deployment.md v3.0.0
-- Enable PostgreSQL extensions required by the application.
-- This script runs on every fresh init (when PGDATA is empty).

-- UUID generation (standard, always available)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Full-text search (English, add more languages as needed)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- JSONB indexing support (built-in in PG17, but GIN ops need pg_trgm)
-- Already available via pg_trgm above.

-- Row-level security (built-in, no extension needed, listed for reference)
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY;  -- applied per-table in 02-init-schema.sql
