#!/usr/bin/env node
// PASS 5 — Conflicts detection.
// 5.1 internal conflicts between 223 pending migrations
// 5.3 vs Sprint 0+1 migrations (20260417100000, 20260417110000)
// 5.4 known Talok patterns (RLS recursion, phantom columns, renames)

import fs from 'node:fs';

const pending = JSON.parse(fs.readFileSync('reports/sprint-a-pending-details.json', 'utf8'));
const DIR = 'supabase/migrations';

const PHANTOM_COLUMNS = ['usage_principal', 'type_bien', 'building_floors'];
const RECURSIVE_POLICY_NAMES = [
  'profiles_owner_read_tenants',
  'subscriptions_owner_select_own',
];

const md = [];
md.push('# Sprint A — PASS 5 : Conflits détectés');
md.push('');
md.push('## 5.1 — Conflits internes (entre migrations pending)');
md.push('');

// Table lifecycle: CREATE → DROP → CREATE ?
const tableEvents = {}; // tableName -> [{file, op}]
const columnEvents = {}; // table.column -> [{file, op}]
const policyEvents = {}; // table:policy -> [{file, op}]

for (const m of pending) {
  const ops = m.ops;
  for (const t of ops.createTable) {
    (tableEvents[t] ||= []).push({ file: m.file, op: 'CREATE' });
  }
  for (const t of ops.dropTable) {
    (tableEvents[t] ||= []).push({ file: m.file, op: 'DROP' });
  }
  for (const c of ops.alterTableAddColumn) {
    (columnEvents[c] ||= []).push({ file: m.file, op: 'ADD' });
  }
  for (const c of ops.alterTableDropColumn) {
    (columnEvents[c] ||= []).push({ file: m.file, op: 'DROP' });
  }
  for (const p of ops.createPolicy) {
    (policyEvents[p] ||= []).push({ file: m.file, op: 'CREATE' });
  }
  for (const p of ops.dropPolicy) {
    (policyEvents[p] ||= []).push({ file: m.file, op: 'DROP' });
  }
}

function hasOscillation(events) {
  // returns true if events contain 2+ distinct ops on same entity
  const ops = new Set(events.map((e) => e.op));
  return ops.size > 1 || events.length > 1;
}

// Tables created multiple times
md.push('### Tables avec CREATE répété ou CREATE/DROP oscillation');
md.push('');
let anyTable = false;
md.push('| Table | Événements |');
md.push('|---|---|');
for (const [t, events] of Object.entries(tableEvents)) {
  if (!hasOscillation(events)) continue;
  anyTable = true;
  const rows = events.map((e) => `${e.op}@${e.file}`).join(' → ');
  md.push(`| \`${t}\` | ${rows.replace(/\|/g, '\\|')} |`);
}
if (!anyTable) md.push('| _aucune_ | _aucune oscillation détectée_ |');
md.push('');

// Columns ADD repeated
md.push('### Colonnes avec ADD répété ou ADD/DROP oscillation');
md.push('');
let anyCol = false;
md.push('| Colonne | Événements |');
md.push('|---|---|');
for (const [c, events] of Object.entries(columnEvents)) {
  if (!hasOscillation(events)) continue;
  anyCol = true;
  md.push(
    `| \`${c}\` | ${events.map((e) => `${e.op}@${e.file}`).join(' → ').replace(/\|/g, '\\|')} |`
  );
}
if (!anyCol) md.push('| _aucune_ | _aucune oscillation détectée_ |');
md.push('');

// Policies oscillation
md.push('### Policies créées/droppées plusieurs fois');
md.push('');
let anyPol = false;
md.push('| Policy (table:name) | Événements |');
md.push('|---|---|');
for (const [p, events] of Object.entries(policyEvents)) {
  if (!hasOscillation(events)) continue;
  anyPol = true;
  md.push(
    `| \`${p}\` | ${events.map((e) => `${e.op}@${e.file}`).join(' → ').replace(/\|/g, '\\|')} |`
  );
}
if (!anyPol) md.push('| _aucune_ | _aucune oscillation détectée_ |');
md.push('');

md.push('## 5.2 — Conflits avec état DB actuel');
md.push('');
md.push(
  '⚠️ **Non vérifiable dans cet audit** : aucune connexion MCP Supabase disponible. Requêtes SQL prêtes dans `reports/sprint-a-schema-actual-queries.sql` pour exécution manuelle avant Sprint B.'
);
md.push('');

md.push('## 5.3 — Conflits avec migrations Sprint 0+1');
md.push('');

const sprint01 = pending.filter((m) =>
  m.file.startsWith('20260417100000') || m.file.startsWith('20260417110000')
);
md.push(`Migrations Sprint 0+1 détectées : ${sprint01.length}`);
for (const m of sprint01) {
  md.push(`- \`${m.file}\` — ${m.level} — ${m.why}`);
}
md.push('');

// Does any pending re-create phone_otp_codes ?
const recreatesPhoneOtp = pending.filter(
  (m) =>
    m.ops.createTable.includes('phone_otp_codes') &&
    m.file !== '20260417100000_drop_phone_otp_codes_refs.sql'
);
md.push('**Re-création de `phone_otp_codes` ?**');
if (recreatesPhoneOtp.length === 0) {
  md.push('- ✅ Aucune migration pending ne re-crée `phone_otp_codes`.');
} else {
  md.push('- 🚨 Des migrations pending créent `phone_otp_codes` :');
  for (const m of recreatesPhoneOtp) md.push(`  - \`${m.file}\``);
}
md.push('');

// Does any pending conflict with cron name cleanup-identity-2fa-expired ?
md.push('**Conflit cron `cleanup-identity-2fa-expired` ?**');
let cronConflict = false;
for (const m of pending) {
  if (m.file === '20260417110000_purge_identity_2fa_cron.sql') continue;
  const content = fs.readFileSync(`${DIR}/${m.file}`, 'utf8');
  if (/cleanup[_-]identity[_-]2fa[_-]expired/i.test(content)) {
    md.push(`- ⚠️ Conflit dans \`${m.file}\``);
    cronConflict = true;
  }
}
if (!cronConflict) md.push('- ✅ Aucun conflit sur le nom du cron.');
md.push('');

md.push('## 5.4 — Patterns connus Talok');
md.push('');

// Recursive policy names
md.push('### Policies RLS supposément droppées (recursion 42P17)');
md.push('');
md.push('| Policy | Fichiers qui la créent (pending) | Verdict |');
md.push('|---|---|---|');
for (const pname of RECURSIVE_POLICY_NAMES) {
  const recreators = [];
  for (const m of pending) {
    const content = fs.readFileSync(`${DIR}/${m.file}`, 'utf8');
    const code = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    const reCreate = new RegExp(
      `CREATE\\s+POLICY\\s+["']?${pname}["']?`,
      'i'
    );
    if (reCreate.test(code)) recreators.push(m.file);
  }
  const verdict = recreators.length === 0 ? '✅ pas recréée' : '🚨 recréée';
  md.push(
    `| \`${pname}\` | ${recreators.length === 0 ? '-' : recreators.join(', ')} | ${verdict} |`
  );
}
md.push('');

// Phantom columns
md.push('### Colonnes phantomes (supposément supprimées)');
md.push('');
md.push('| Colonne | Fichiers qui l\'ajoutent (pending) | Verdict |');
md.push('|---|---|---|');
for (const col of PHANTOM_COLUMNS) {
  const adders = [];
  for (const m of pending) {
    const content = fs.readFileSync(`${DIR}/${m.file}`, 'utf8');
    const code = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    const re = new RegExp(`ADD\\s+COLUMN\\s+(IF\\s+NOT\\s+EXISTS\\s+)?${col}\\b`, 'i');
    if (re.test(code)) adders.push(m.file);
  }
  const verdict = adders.length === 0 ? '✅ pas ré-ajoutée' : '🚨 ré-ajoutée';
  md.push(
    `| \`${col}\` | ${adders.length === 0 ? '-' : adders.join(', ')} | ${verdict} |`
  );
}
md.push('');

// Renames (statut, plan_slug)
md.push('### Renames critiques (leases.status↔statut, subscriptions.plan↔plan_slug)');
md.push('');
const renameMentions = [];
for (const m of pending) {
  const content = fs.readFileSync(`${DIR}/${m.file}`, 'utf8');
  const code = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
  if (/RENAME\s+COLUMN\s+(status|statut|plan|plan_slug)\b/i.test(code)) {
    renameMentions.push({
      file: m.file,
      renames: (code.match(/RENAME\s+COLUMN[^;]+/gi) || []).slice(0, 3),
    });
  }
}
if (renameMentions.length === 0) {
  md.push('✅ Aucun RENAME COLUMN sur `status`/`statut`/`plan`/`plan_slug` dans les pending.');
} else {
  md.push('| Fichier | Renames |');
  md.push('|---|---|');
  for (const r of renameMentions) {
    md.push(`| \`${r.file}\` | ${r.renames.join('; ').replace(/\|/g, '\\|')} |`);
  }
}
md.push('');

// property_owners table
md.push('### Table `property_owners` (supposée inexistante)');
md.push('');
const propertyOwnersCreators = pending.filter((m) => m.ops.createTable.includes('property_owners'));
if (propertyOwnersCreators.length === 0) {
  md.push('✅ Aucune migration pending ne crée `property_owners`.');
} else {
  md.push('🚨 Migrations qui tentent de créer `property_owners` :');
  for (const m of propertyOwnersCreators) md.push(`- \`${m.file}\``);
}
md.push('');

// Duplicate timestamps (from PASS 1 stats)
const pass1 = JSON.parse(fs.readFileSync('reports/sprint-a-pass1-stats.json', 'utf8'));
md.push('## 5.5 — Timestamps dupliqués');
md.push('');
md.push(
  `**${pass1.duplicateTimestampsCount}** timestamps avec ≥2 fichiers. Certains doublons sont des pendants "same second, different slug", d'autres sont du content divergent.`
);
md.push('');
md.push('| Timestamp | Fichiers |');
md.push('|---|---|');
for (const [ts, fs_] of Object.entries(pass1.duplicates)) {
  md.push(`| \`${ts}\` | ${fs_.map((f) => `\`${f}\``).join('<br>')} |`);
}
md.push('');

fs.writeFileSync('reports/sprint-a-conflicts-report.md', md.join('\n') + '\n');
console.log('Wrote reports/sprint-a-conflicts-report.md');

// Print red flags count for summary
const flags = {
  internalTableOscillations: anyTable ? 1 : 0,
  internalColumnOscillations: anyCol ? 1 : 0,
  internalPolicyOscillations: anyPol ? 1 : 0,
  recreatesPhoneOtp: recreatesPhoneOtp.length,
  cronConflict: cronConflict ? 1 : 0,
  phantomColumnsReAdded: PHANTOM_COLUMNS.filter((c) =>
    pending.some((m) => {
      const content = fs.readFileSync(`${DIR}/${m.file}`, 'utf8');
      const code = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
      return new RegExp(`ADD\\s+COLUMN\\s+(IF\\s+NOT\\s+EXISTS\\s+)?${c}\\b`, 'i').test(code);
    })
  ),
  propertyOwnersCreators: propertyOwnersCreators.length,
  duplicateTimestamps: pass1.duplicateTimestampsCount,
  renameMentions: renameMentions.length,
};
fs.writeFileSync('reports/sprint-a-pass5-stats.json', JSON.stringify(flags, null, 2));
console.log(JSON.stringify(flags, null, 2));
