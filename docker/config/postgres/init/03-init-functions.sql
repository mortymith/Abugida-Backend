-- 03-init-functions.sql
-- Source: deployment.md v3.0.0
-- Stored procedures and utility functions for the application.

-- ============================================================================
-- Soft delete helper
-- ============================================================================
CREATE OR REPLACE FUNCTION soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    NEW.deleted_at = now();
    NEW.is_active = false;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Audit trail trigger (auto-logs writes to audit_log)
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_action VARCHAR(100);
    v_resource_type VARCHAR(100);
BEGIN
    v_resource_type := TG_TABLE_NAME;
    IF TG_OP = 'INSERT' THEN
        v_action := 'insert';
        INSERT INTO audit_log (actor_id, action, resource_type, resource_id, metadata)
        VALUES (NEW.created_by, v_action, v_resource_type, NEW.id,
                jsonb_build_object('new', row_to_json(NEW)));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
        INSERT INTO audit_log (actor_id, action, resource_type, resource_id, metadata)
        VALUES (NEW.updated_by, v_action, v_resource_type, NEW.id,
                jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW)));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'delete';
        INSERT INTO audit_log (actor_id, action, resource_type, resource_id, metadata)
        VALUES (NULL, v_action, v_resource_type, OLD.id,
                jsonb_build_object('old', row_to_json(OLD)));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Pagination helper (keyset/cursor-based, avoids OFFSET performance issues)
-- ============================================================================
CREATE OR REPLACE FUNCTION paginate_query(
    p_table TEXT,
    p_cursor TIMESTAMPTZ DEFAULT NULL,
    p_limit  INT DEFAULT 20
)
RETURNS JSONB AS $$
DECLARE
    v_sql TEXT;
    v_result JSONB;
BEGIN
    v_sql := format(
        'SELECT jsonb_agg(row_to_json(t)) FROM (
             SELECT * FROM %I
             WHERE ($1::timestamptz IS NULL OR created_at < $1::timestamptz)
             ORDER BY created_at DESC
             LIMIT $2
         ) t',
        p_table
    );
    EXECUTE v_sql INTO v_result USING p_cursor, p_limit;
    RETURN coalesce(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Health check (used by PgBouncer and monitoring)
-- ============================================================================
CREATE OR REPLACE FUNCTION health_check()
RETURNS TABLE (status TEXT, ts TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY SELECT 'ok'::TEXT, now()::TIMESTAMPTZ;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
