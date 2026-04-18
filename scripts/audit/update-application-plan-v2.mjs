#!/usr/bin/env node
// Sprint B1 — PASS 7
// Update sprint-a-application-plan.md to v2 with Sprint B1 context:
// - Pre-req: PASS 1 real + reconciliation SQL applied
// - Dedup applied (223 files → 222 unique, since 1 ghost excluded)
// - Update risk counts if dedup changes anything (hash-divergent
//   duplicates means each stays, so counts unchanged).

import fs from 'node:fs';

const fsSnap = JSON.parse(fs.readFileSync('reports/sprint-b1-filesystem-migrations.json', 'utf8'));
const matrix = JSON.parse(fs.readFileSync('reports/sprint-b1-reconciliation-matrix.json', 'utf8'));
const dedup = JSON.parse(fs.readFileSync('reports/sprint-b1-dedup-plan.json', 'utf8'));
const passA = fs.readFileSync('reports/sprint-a-application-plan.md', 'utf8');

const totalPending = matrix.counts.pending + matrix.counts.duplicateTs;
const uniquePending = matrix.counts.pending + fsSnap.duplicates.length;

// Build v2 prologue to prepend
const prologue = [];
prologue.push('# Sprint A — PASS 7 v2 : Plan d\'application phasé (post Sprint B1)');
prologue.push('');
prologue.push('> ℹ️ **Cette v2 remplace la v1 initiale.** La v1 raisonnait sur 223 pending sans distinction duplicates. Sprint B1 a affiné :');
prologue.push('>');
prologue.push(`> - **${matrix.counts.pending}** pending à timestamp unique (ordre d'application déterministe)`);
prologue.push(`> - **${matrix.counts.duplicateTs}** pending dans 13 groupes de timestamps dupliqués → à dédup PUIS appliquer`);
prologue.push(`> - **${matrix.counts.ghostApplied}** ghost (\`20260208024659\`) à résoudre hors plan (cf. PASS 4)`);
prologue.push(`> - **Total après dédup : ${uniquePending} migrations uniques** à appliquer`);
prologue.push('');

prologue.push('## Phase 0 — Pré-requis (mise à jour Sprint B1)');
prologue.push('');
prologue.push('### Pré-requis DB (Sprint B1 ➜ Sprint B2)');
prologue.push('- [ ] **PASS 1 Sprint B1 exécuté** : `reports/sprint-b1-schema-migrations-prod.json` peuplé avec snapshot réel');
prologue.push('- [ ] **Matrice de réconciliation** re-générée en mode complet (non-dégradé) :');
prologue.push('      ```');
prologue.push('      node scripts/audit/build-reconciliation-matrix.mjs');
prologue.push('      ```');
prologue.push('- [ ] **Ghost 20260208024659 traité** (Option A1/A2/A3 de `sprint-b1-reconciliation-sql.sql`)');
prologue.push('- [ ] **Dédup timestamps appliqué** : les 28 renames `git mv` exécutés sur branche `chore/migrations-dedup-timestamps`, mergée');
prologue.push('- [ ] **`schema_migrations` UPDATE** exécuté pour chaque rename qui était déjà tracké prod (section C de `sprint-b1-reconciliation-sql.sql`)');
prologue.push('- [ ] **HASH MISMATCH** : aucune divergence détectée ou chacune résolue manuellement');
prologue.push('');
prologue.push('### Pré-requis infra (inchangés depuis v1)');
prologue.push('- [ ] Backup prod (snapshot Supabase PITR) horodaté juste avant Phase 1');
prologue.push('- [ ] Staging Supabase disponible (cf. `sprint-a-staging-detection.md` → décision Option A/B/C)');
prologue.push('- [ ] Rollback script prêt : `pg_restore` depuis snapshot pour chaque phase');
prologue.push('- [ ] Cron secret configuré (`ALTER DATABASE postgres SET app.settings.cron_secret = ...`)');
prologue.push('- [ ] `app.settings.app_url` configuré');
prologue.push('- [ ] Extension `pg_cron` activée');
prologue.push('- [ ] `TWILIO_VERIFY_SERVICE_SID` configuré dans Netlify');
prologue.push('- [ ] Annoncer maintenance window ≥ 2h pour Phase 4 (CRITIQUE)');
prologue.push('');

prologue.push('## Révision des compteurs post-dédup');
prologue.push('');
prologue.push('| Avant Sprint B1 (v1) | Après Sprint B1 (v2) | Explication |');
prologue.push('|---|---|---|');
prologue.push(`| 223 pending (dont 41 en dup) | ${uniquePending} pending uniques | dédup = 13 timestamps uniques conservés, 28 renommés |`);
prologue.push(`| SAFE 46 / MODÉRÉ 76 / DANGEREUX 51 / CRITIQUE 50 | **Identique** | hash-divergent dedup → aucune migration supprimée, juste renommée |`);
prologue.push('');
prologue.push('**Important** : les renames ne changent **pas** le contenu SQL ni le niveau de risque d\'une migration. Ils déplacent juste son timestamp de +Ns. Chaque migration reste à appliquer.');
prologue.push('');
prologue.push('## Notes sur les duplicate groups');
prologue.push('');
prologue.push('Les 13 groupes seront appliqués dans l\'ordre chronologique **après rename**. Exemple pour `20260408130000` (12 files) :');
prologue.push('');
prologue.push('```');
prologue.push('20260408130000_<a>.sql           (keep)');
prologue.push('20260408130001_<b>.sql           (rename +1s)');
prologue.push('20260408130002_<c>.sql           (rename +2s)');
prologue.push('...');
prologue.push('20260408130011_<l>.sql           (rename +11s)');
prologue.push('```');
prologue.push('');
prologue.push('Ordre alphabétique du slug détermine l\'ordre d\'exécution. **Attention** : si l\'ordre logique attendu est différent (ex : la 3ᵉ doit passer avant la 1ʳᵉ), décider manuellement avant d\'exécuter `apply-dedup-renames.sh`.');
prologue.push('');

prologue.push('---');
prologue.push('');
prologue.push('> Ce qui suit est **inchangé depuis v1** (plan Phase 1-4, candidats squash, stratégie). Lire au complet.');
prologue.push('');
prologue.push('---');
prologue.push('');

const v2 = prologue.join('\n') + passA;
fs.writeFileSync('reports/sprint-a-application-plan.md', v2);
console.log('Prepended v2 prologue to reports/sprint-a-application-plan.md');
console.log(`Total pending (with dup): ${totalPending}`);
console.log(`Unique after dedup: ${uniquePending}`);
