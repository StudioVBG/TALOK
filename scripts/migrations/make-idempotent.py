#!/usr/bin/env python3
"""Transform a SQL migration to prepend DROP POLICY IF EXISTS before each CREATE POLICY,
and DROP TRIGGER IF EXISTS before each CREATE TRIGGER (if not already present)."""
import re
import sys

_IDENT = r'(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)'
_QUALIFIED = rf'{_IDENT}(?:\.{_IDENT})?'

CREATE_POLICY_RE = re.compile(
    rf'^([ \t]*)CREATE POLICY (?P<name>{_IDENT})'
    rf'\s+ON\s+(?P<table>{_QUALIFIED})',
    re.MULTILINE,
)

# Matches CREATE TRIGGER optionally preceded (anywhere earlier in file) by DROP TRIGGER IF EXISTS
CREATE_TRIGGER_RE = re.compile(
    rf'^([ \t]*)CREATE TRIGGER (?P<name>{_IDENT})'
    rf'.*?(?:BEFORE|AFTER|INSTEAD OF).*?ON\s+(?P<table>{_QUALIFIED})',
    re.MULTILINE | re.DOTALL,
)

DROP_POLICY_RE = re.compile(
    rf'DROP POLICY IF EXISTS\s+(?P<name>{_IDENT})\s+ON\s+(?P<table>{_QUALIFIED})',
    re.IGNORECASE,
)


def transform(sql: str) -> str:
    # Collect drops already present for triggers
    existing_trigger_drops = set(
        re.findall(r'DROP TRIGGER IF EXISTS\s+("?[A-Za-z_][A-Za-z0-9_]*"?)', sql)
    )

    # Collect (name, table) pairs already dropped for policies — avoid duplicate drop.
    existing_policy_drops = set(
        (m.group("name"), m.group("table")) for m in DROP_POLICY_RE.finditer(sql)
    )

    # Need to match the full prefix to preserve the rest
    def policy_full_sub(m: re.Match) -> str:
        indent = m.group(1)
        name = m.group("name")
        table = m.group("table")
        if (name, table) in existing_policy_drops:
            # An explicit DROP POLICY IF EXISTS already covers this policy.
            return m.group(0)
        return (
            f"{indent}DROP POLICY IF EXISTS {name} ON {table};\n"
            f"{m.group(0)}"
        )

    out = CREATE_POLICY_RE.sub(policy_full_sub, sql)

    # Also handle EXECUTE 'CREATE POLICY "name" ON table ...' patterns inside DO blocks.
    # Prepend an EXECUTE 'DROP POLICY IF EXISTS ...' on the same line.
    execute_policy_re = re.compile(
        rf"^([ \t]*)EXECUTE\s+'CREATE POLICY (?P<name>{_IDENT})"
        rf"\s+ON\s+(?P<table>{_QUALIFIED})",
        re.MULTILINE | re.IGNORECASE,
    )

    def execute_policy_sub(m: re.Match) -> str:
        indent = m.group(1)
        name = m.group("name")
        table = m.group("table")
        return (
            f"{indent}EXECUTE 'DROP POLICY IF EXISTS {name} ON {table}';\n"
            f"{m.group(0)}"
        )

    out = execute_policy_re.sub(execute_policy_sub, out)

    # Triggers: only prepend DROP if not already present
    def trigger_full_sub(m: re.Match) -> str:
        indent = m.group(1)
        name = m.group("name")
        table = m.group("table")
        if name in existing_trigger_drops or name.strip('"') in existing_trigger_drops:
            return m.group(0)
        return (
            f"{indent}DROP TRIGGER IF EXISTS {name} ON {table};\n"
            f"{m.group(0)}"
        )

    out = CREATE_TRIGGER_RE.sub(trigger_full_sub, out)

    # Make CREATE INDEX idempotent — add IF NOT EXISTS where missing.
    out = re.sub(
        r"^(\s*)CREATE(\s+UNIQUE)?\s+INDEX\s+(?!IF\s+NOT\s+EXISTS\b)",
        lambda m: f"{m.group(1)}CREATE{m.group(2) or ''} INDEX IF NOT EXISTS ",
        out,
        flags=re.MULTILINE | re.IGNORECASE,
    )

    # Make ALTER TABLE ... ADD CONSTRAINT idempotent by prepending
    # ALTER TABLE ... DROP CONSTRAINT IF EXISTS <name>; (when not already present)
    drop_constraint_pairs = set(
        (t.strip('"'), n.strip('"'))
        for t, n in re.findall(
            rf"ALTER\s+TABLE\s+(?:ONLY\s+)?({_QUALIFIED})\s+DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+({_IDENT})",
            out,
            flags=re.IGNORECASE,
        )
    )

    add_constraint_re = re.compile(
        rf"^([ \t]*)ALTER\s+TABLE\s+(?:ONLY\s+)?(?P<table>{_QUALIFIED})"
        rf"\s+ADD\s+CONSTRAINT\s+(?P<name>{_IDENT})",
        re.MULTILINE | re.IGNORECASE,
    )

    def add_constraint_sub(m: re.Match) -> str:
        indent = m.group(1)
        table = m.group("table")
        name = m.group("name")
        if (table.strip('"'), name.strip('"')) in drop_constraint_pairs:
            return m.group(0)
        return (
            f"{indent}ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {name};\n"
            f"{m.group(0)}"
        )

    out = add_constraint_re.sub(add_constraint_sub, out)

    # --- Targeted bug fixes for known-broken migrations ---
    # tickets.provider_id never existed — the trigger references a phantom column.
    # Replace the second trigger's DO block with a comment note.
    if "trg_notify_provider_on_work_order" in out and "UPDATE OF provider_id ON tickets" in out:
        out = re.sub(
            r"-- =+\n-- TRIGGER 2:.*?END;\s*\$\$;\s*",
            (
                "-- TRIGGER 2 SKIPPED : references tickets.provider_id which never existed.\n"
                "-- The provider is linked via work_orders.provider_id, not tickets.\n"
                "-- The function notify_provider_on_work_order() is left defined above\n"
                "-- for future use once the column semantics are fixed.\n"
            ),
            out,
            flags=re.DOTALL,
        )

    # properties.deleted_by is UUID REFERENCES profiles(id) — cannot store an
    # arbitrary string marker. Replace the UPDATE assignment with NULL so the
    # soft-delete still happens (deleted_at = NOW()) without FK violation.
    # Also neutralize the WHERE selector used for the count NOTICE: replace the
    # equality on the bad string with IS NOT NULL so the NOTICE still reports
    # a reasonable count within the time window.
    if "'system-dedup-migration'" in out:
        out = re.sub(
            r"deleted_by\s*=\s*'system-dedup-migration'",
            "deleted_by = NULL",
            out,
        )
        # The count NOTICE used the same string — after substitution we get
        # WHERE deleted_by = NULL which always returns no rows. Rewrite it to
        # the time window alone, which is the real intent.
        out = re.sub(
            r"WHERE deleted_by\s*=\s*NULL\s+AND\s+(deleted_at\s*>=\s*NOW\(\)\s*-\s*INTERVAL\s*'1 minute')",
            r"WHERE \1",
            out,
        )

    # tenant_documents.updated_at does not exist — only uploaded_at and created_at.
    # Migration 20260326022700_migrate_tenant_documents.sql references td.updated_at.
    # Substitute with uploaded_at which carries the same semantic intent.
    if "td.updated_at" in out and "FROM tenant_documents td" in out:
        out = out.replace("td.updated_at", "td.uploaded_at")

    # Migration 20260410110000_cleanup_orphan_analyses.sql : RAISE NOTICE
    # concatenates '...' and E'...' literals on separate lines — the PL/pgSQL
    # parser rejects mixing standard and escape string literals that way.
    # Collapse to a single E-string with literal \n.
    if "cleanup-orphan-analyses" in out and "pg_cron extension not installed" in out:
        old = (
            "    RAISE NOTICE 'pg_cron extension not installed; skipping schedule. '\n"
            "      'Enable pg_cron from the Supabase dashboard and run:'\n"
            "      E'\\n  SELECT cron.schedule(''cleanup-orphan-analyses'', ''0 3 * * 0'', '\n"
            "      E'''SELECT public.fn_cleanup_orphan_document_analyses();'');';"
        )
        new = (
            "    RAISE NOTICE E'pg_cron extension not installed; skipping schedule. "
            "Enable pg_cron from the Supabase dashboard and run:\\n  "
            "SELECT cron.schedule(''cleanup-orphan-analyses'', ''0 3 * * 0'', "
            "''SELECT public.fn_cleanup_orphan_document_analyses();'');';"
        )
        out = out.replace(old, new)

    # COMMENT ON SCHEMA cron requires schema ownership which postgres role
    # does not have on Supabase. Skip any such statements (doc-only, non-critical).
    out = re.sub(
        r"^\s*COMMENT\s+ON\s+SCHEMA\s+cron\s+IS\s+.*?;\s*$",
        "-- COMMENT ON SCHEMA cron SKIPPED (postgres is not owner on Supabase)",
        out,
        flags=re.MULTILINE | re.IGNORECASE | re.DOTALL,
    )

    # charge_regularisations RENAME is not idempotent. Guard with a DO block
    # that checks the source table exists and the target doesn't.
    if "ALTER TABLE public.charge_regularisations RENAME TO charge_regularisations_legacy" in out:
        out = out.replace(
            "ALTER TABLE public.charge_regularisations RENAME TO charge_regularisations_legacy;",
            (
                "DO $RENAME$ BEGIN\n"
                "  IF EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='charge_regularisations' AND table_type='BASE TABLE')\n"
                "     AND NOT EXISTS (SELECT 1 FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='charge_regularisations_legacy') THEN\n"
                "    EXECUTE 'ALTER TABLE public.charge_regularisations RENAME TO charge_regularisations_legacy';\n"
                "  END IF;\n"
                "END $RENAME$;"
            ),
        )

    return out


if __name__ == "__main__":
    sql = sys.stdin.read()
    sys.stdout.write(transform(sql))
