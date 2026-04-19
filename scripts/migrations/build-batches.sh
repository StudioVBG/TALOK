#!/bin/bash
# Build idempotent migration batches from a sprint JSON manifest.
#
# Usage (from repo root):
#   bash scripts/migrations/build-batches.sh <manifest.json> [label]
#
# - manifest.json : un reports/sprint-X-migrations-to-apply.json liste
#   les migrations avec {file, effective_ts, action, risk, risk_why}.
#   Seules les entries action="apply" sont incluses.
# - label         : prefixe de sortie (default "SPRINT_B2")
#
# Chaque batch (1 par mois) est ecrit dans supabase/apply_scripts/ avec :
#   - chaque migration en BEGIN/COMMIT distinct
#   - SET LOCAL lock_timeout = '3s' + statement_timeout = '10min'
#   - RAISE NOTICE de progression "Applying N/M (RISK) file"
#   - transformation idempotente via make-idempotent.py
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

SRC="${1:-reports/sprint-b2-migrations-to-apply.json}"
LABEL_PREFIX="${2:-SPRINT_B2}"
OUT_DIR="supabase/apply_scripts"
TRANSFORM="${SCRIPT_DIR}/make-idempotent.py"

if [[ ! -f "${SRC}" ]]; then
  echo "Manifest not found: ${SRC}" >&2
  exit 1
fi

mapfile -t ALL < <(jq -r '.migrations | map(select(.action == "apply")) | sort_by(.effective_ts) | .[] | [.effective_ts, .file, .risk, .risk_why] | @tsv' "$SRC")

build_batch() {
  local prefix="$1" label="$2" out_file="$3"
  local filtered=()
  local counts_safe=0 counts_modere=0 counts_dangereux=0 counts_critique=0
  local first_ts="" last_ts=""
  for row in "${ALL[@]}"; do
    local ts file risk why
    IFS=$'\t' read -r ts file risk why <<< "$row"
    if [[ "$ts" == "$prefix"* ]]; then
      filtered+=("$ts	$file	$risk	$why")
      [[ -z "$first_ts" ]] && first_ts="$ts"
      last_ts="$ts"
      case "$risk" in
        SAFE) counts_safe=$((counts_safe+1));;
        MODERE) counts_modere=$((counts_modere+1));;
        DANGEREUX) counts_dangereux=$((counts_dangereux+1));;
        CRITIQUE) counts_critique=$((counts_critique+1));;
      esac
    fi
  done

  local total=${#filtered[@]}
  {
    cat <<EOF
-- =============================================================================
-- APPLY SPRINT B2 — BATCH ${label} (IDEMPOTENT v2)
-- Genere le $(date -u +%Y-%m-%dT%H:%M:%SZ)
--
-- Contenu : ${total} migrations (action=apply uniquement)
-- Plage   : ${first_ts} -> ${last_ts}
-- Risque  : SAFE=${counts_safe} / MODERE=${counts_modere} / DANGEREUX=${counts_dangereux} / CRITIQUE=${counts_critique}
--
-- IDEMPOTENCE : chaque CREATE POLICY est precede d'un DROP POLICY IF EXISTS,
-- chaque CREATE TRIGGER est precede d'un DROP TRIGGER IF EXISTS.
-- Les CREATE TABLE/INDEX/FUNCTION utilisent deja IF NOT EXISTS ou OR REPLACE.
-- => Re-executable sans erreur si une migration a deja ete partiellement appliquee.
--
-- INSTRUCTIONS :
-- 1. BACKUP prod obligatoire avant execution (pg_dump + Supabase PITR).
-- 2. Ouvrir Supabase Dashboard > SQL Editor > New Query.
-- 3. Coller ce fichier integralement et cliquer Run.
-- 4. Chaque migration est encapsulee dans son propre BEGIN/COMMIT : rollback cible.
-- 5. Ne PAS appliquer les 28 migrations "rename-then-apply" (branche dedup requise).
--
-- ORDRE : CHRONOLOGIQUE STRICT — ne pas reordonner.
-- =============================================================================

EOF
    local idx=0
    for row in "${filtered[@]}"; do
      idx=$((idx+1))
      IFS=$'\t' read -r ts file risk why <<< "$row"
      cat <<EOF

-- -----------------------------------------------------------------------------
-- ${idx}/${total} -- ${ts} -- ${risk} -- ${file}
-- risk: ${why}
-- -----------------------------------------------------------------------------
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10min';
DO \$\$ BEGIN RAISE NOTICE 'Applying ${idx}/${total} (${risk}) ${file}'; END \$\$;
EOF
      python3 "$TRANSFORM" < "supabase/migrations/${file}"
      cat <<EOF

COMMIT;
EOF
    done
  } > "${out_file}"
  echo "Wrote ${out_file} (${total} migrations)"
}

MONTHS_FR=(JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC)
mapfile -t DISTINCT_MONTHS < <(jq -r '.migrations | map(select(.action == "apply") | .effective_ts[0:6]) | unique | .[]' "$SRC")

idx=0
for month in "${DISTINCT_MONTHS[@]}"; do
  idx=$((idx+1))
  year="${month:0:4}"
  month_num="${month:4:2}"
  month_name="${MONTHS_FR[$((10#${month_num} - 1))]}"
  order=$(printf '%02d' "$idx")
  label="${order}_${month_name}${year}"
  out_file="${OUT_DIR}/APPLY_${LABEL_PREFIX}_${label}.sql"
  build_batch "$month" "$label" "$out_file"
done
