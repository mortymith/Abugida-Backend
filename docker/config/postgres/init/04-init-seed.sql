-- 04-init-seed.sql
-- Source: deployment.md v3.0.0 §4.1 (development only)
-- 
-- This file is ONLY sourced in the development overlay.
-- Production overlay does not mount this file into the container.
-- Seed data is never applied to production.

-- ============================================================================
-- Dev-only seed user
-- ============================================================================
INSERT INTO users (email, username, password_hash, full_name, role, email_verified_at)
VALUES (
    'dev@example.com',
    'devuser',
    '$2b$12$LJ3m4ys3Lk/r5FhFJVGQHOBWbFZFMF1Mv5q.kQMbqe0MJGf3hFJPu',
    'Development User',
    'admin',
    now()
) ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- Additional sample users for load testing
-- ============================================================================
INSERT INTO users (email, username, password_hash, full_name, role, email_verified_at)
VALUES
    ('alice@example.com', 'alice', '$2b$12$LJ3m4ys3Lk/r5FhFJVGQHOBWbFZFMF1Mv5q.kQMbqe0MJGf3hFJPu', 'Alice', 'user', now()),
    ('bob@example.com',   'bob',   '$2b$12$LJ3m4ys3Lk/r5FhFJVGQHOBWbFZFMF1Mv5q.kQMbqe0MJGf3hFJPu', 'Bob',   'user', now())
ON CONFLICT (email) DO NOTHING;
