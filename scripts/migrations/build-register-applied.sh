#!/bin/bash
# Build a registration SQL script that inserts the "apply" migrations of a
# sprint manifest into supabase_migrations.schema_migrations. To run ONCE
# after manually applying the batches via the Supabase SQL Editor, so that
# `supabase db push` later sees them as already applied and skips them.
#
# Usage (from repo root):
#   bash scripts/migrations/build-register-applied.sh <manifest.json> [label]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

SRC="${1:-reports/sprint-b2-migrations-to-apply.json}"
LABEL="${2:-SPRINT_B2}"
OUT="supabase/apply_scripts/REGISTER_${LABEL}_APPLIED.sql"

if [[ ! -f "${SRC}" ]]; then
  echo "Manifest not found: ${SRC}" >&2
  exit 1
fi

TOTAL=$(jq -r '[.migrations[] | select(.action == "apply")] | length' "$SRC")

{
  cat <<EOF
-- =============================================================================
-- REGISTER APPLIED MIGRATIONS — ${LABEL}
-- Genere le $(date -u +%Y-%m-%dT%H:%M:%SZ)
--
-- Les ${TOTAL} migrations (action=apply) du sprint ont ete executees
-- manuellement via le Supabase SQL Editor, elles n'apparaissent donc pas
-- dans supabase_migrations.schema_migrations et un futur 'supabase db push'
-- retentera de les appliquer -> erreurs.
--
-- Ce script les enregistre dans la table de tracking pour que le CLI
-- sache qu'elles sont deja en prod.
--
-- USAGE : a coller une fois dans le Supabase SQL Editor APRES avoir verifie
-- que tous les batches ont passe sans erreur.
--
-- Idempotent : ON CONFLICT DO NOTHING si deja enregistrees.
-- =============================================================================

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES
EOF

  # Iterate over each migration and emit an INSERT row.
  jq -r '.migrations
    | map(select(.action == "apply"))
    | sort_by(.effective_ts)
    | .[]
    | [.effective_ts, (.file | sub("^[0-9]+_"; "") | sub("\\.sql$"; ""))]
    | @tsv' "$SRC" |
  awk -v total="$TOTAL" 'BEGIN { OFS=""; i=0 }
    {
      i++
      # Escape single quotes in name for SQL safety.
      gsub(/'"'"'/, "'"'"''"'"'", $2)
      sep = (i < total) ? "," : ""
      printf "  (%s%s%s, %s%s%s, ARRAY[]::text[])%s\n", "'"'"'", $1, "'"'"'", "'"'"'", $2, "'"'"'", sep
    }'

  cat <<EOF
ON CONFLICT (version) DO NOTHING;

-- Verification : combien de lignes nouvellement enregistrees
SELECT COUNT(*) AS registered_total,
       MIN(version) AS first_version,
       MAX(version) AS last_version
  FROM supabase_migrations.schema_migrations
 WHERE version >= '20260208100000'
   AND version <= '20260417110000';
EOF
} > "${OUT}"

echo "Wrote ${OUT} (${TOTAL} migrations)"
