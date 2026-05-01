# Audit dette technique — Dead code (ts-prune)

> Généré : 2026-05-01
> Outil : `npx ts-prune`
> Branche : `claude/talok-comprehensive-audit-570hs`

## Résumé chiffré

| Métrique | Valeur |
|---|---|
| Total exports détectés non utilisés | **4 301** |
| Hors barrel index.ts | **1 144** entrées |
| **Vrais candidats à suppression** (hors `(used in module)`) | **3 267** |
| Fichiers concernés (uniques) | 250+ |

⚠️ **Beaucoup de faux positifs** : ts-prune ne détecte pas les conventions Next.js (`default export` consommé par le routeur, `metadata`, `viewport`, `dynamic`, `runtime`, etc.). Il faut filtrer manuellement.

---

## Top 10 fichiers à plus forte densité de dead exports

| Rang | Fichier | Exports inutilisés |
|------|---------|---------------------|
| 1 | `lib/types/index.ts` | 359 |
| 2 | `lib/validations/index.ts` | 147 |
| 3 | `lib/subscriptions/index.ts` | 101 |
| 4 | `lib/services/index.ts` | 96 |
| 5 | `lib/accounting/index.ts` | 78 |
| 6 | `lib/api/schemas.ts` | 68 |
| 7 | `lib/supabase/database.types.ts` | 61 |
| 8 | `lib/design-system/index.ts` | 56 |
| 9 | `lib/hooks/index.ts` | 53 |
| 10 | `features/legal-entities/index.ts` | 53 |

> **Recommandation** : la plupart de ces fichiers sont des **barrel exports** (`index.ts` qui ré-exportent tout). C'est intentionnel pour offrir une API centralisée. Ne pas supprimer en bloc — vérifier au cas par cas si l'export interne est consommé en dehors du barrel.

---

## Vrais candidats à suppression (hors barrels et conventions Next.js)

### Bibliothèque applicative

| Fichier | Export | Action |
|---|---|---|
| `lib/api.ts` | `PropertyAPI`, `UnitAPI` | ❓ À vérifier — probablement legacy avant migration vers `apiClient` |
| `lib/billing-utils.ts` | `getAllTvaRates`, `formatPriceCompact`, `TVA_TERRITORY_GROUPS` | ⚠️ Vérifier — pourraient être utilisés par le marketing |
| `lib/rbac.ts` | `getRolesForSite`, `ROLE_HIERARCHY`, `ROLE_COLORS`, `ROLE_ICONS` | ❌ Suppr probable — duplique `secondary-role-manifest.ts` |
| `lib/safe-action.ts` | `ownerAction`, `adminAction` | ❌ Probablement remplacé par `lib/middleware/admin-rbac` |
| `lib/stripe-client.ts` | `getWebhookSecret` | ❌ Suppr probable |
| `lib/utils.ts` | `safeDateFormat` | ⚠️ Sur-couche d'helpers/format |
| `lib/accounting/chart-amort-ocr.ts` | `STANDARD_COMPONENTS` | ⚠️ Constants d'amortissement, à vérifier |
| `lib/accounting/fec-timestamp.ts` | `requestFecTimestamp` | ⚠️ Feature horodatage FEC non encore wirée |
| `lib/api/webhooks.ts` | `dispatchWebhookEvent` | ⚠️ Future API webhooks Pro+ |
| `lib/billing/tva.ts` | `calculateTVAAmount` | ⚠️ Doublon possible avec billing-utils.ts |
| `lib/cache/client-cache.ts` | `withCache`, `createCacheKey` | ❌ Probable remplacement par TanStack Query |
| `lib/cache/invalidation.service.ts` | `useCacheInvalidation` | ❌ Probable remplacement |

### Faux positifs identifiés

Les exports suivants sont signalés mais sont en réalité **utilisés** :
- Toutes les conventions Next.js : `default export` (page/layout/error/loading/not-found), `metadata`, `viewport`, `dynamic`, `runtime`, `revalidate`
- Les exports tout récents de cette session (créés mais pas encore wirés sur les routes existantes) :
  - `lib/audit/copro-audit.ts:171 — getCoproAuditLogs` ✅ utilisé par futur admin UI
  - `lib/auth/copro-rbac.ts:75 — requireCoproRole` ✅ helper documenté pour usage futur
  - `lib/auth/copro-rbac.ts:185 — getUserCoproRole` ✅ helper public
  - `lib/auth/copro-rbac.ts:207 — hasAtLeastRole` ✅ helper public

---

## Stratégie de nettoyage recommandée (en 3 phases)

### Phase 1 — Quick wins (faible risque, ~1j)

1. **Supprimer `lib/cache/`** s'il est vraiment remplacé par TanStack Query (vérifier les imports actifs avant)
2. **Consolider `lib/billing-utils.ts` et `lib/billing/tva.ts`** (probable duplication de `calculateTVAAmount`)
3. **Supprimer `lib/api.ts`** (PropertyAPI/UnitAPI legacy — vérifier qu'aucun composant ne l'importe)

### Phase 2 — Audit barrel (moyen risque, ~2j)

Pour chaque `index.ts` à fort score :
1. Lister les exports
2. Pour chaque export, `grep -rn "import.*<export>" app components features` pour confirmer non-utilisation
3. Supprimer l'export du barrel
4. Si plus aucun consommateur du fichier source → supprimer le fichier

### Phase 3 — Audit composants morts (haut risque, ~2j)

```bash
# Liste des composants .tsx dans components/ jamais importés
find components -name "*.tsx" -type f | while read f; do
  basename=$(basename "$f" .tsx)
  imports=$(grep -rln "from.*${basename}\|import.*${basename}" app features components --exclude="$f" 2>/dev/null | wc -l)
  if [ "$imports" -eq "0" ]; then
    echo "$f"
  fi
done
```

⚠️ **Toujours vérifier manuellement** avant suppression : un composant peut être consommé via `lazy()`, `dynamic()`, ou des chemins indirects que grep ne capture pas.

---

## Outils complémentaires recommandés

```bash
# Dépendances inutilisées (npm packages non importés)
npx depcheck

# Knip — analyse plus avancée (configuration .knip.json possible)
npx knip --reporter compact

# Vérifier les routes API jamais appelées par le frontend
find app/api -name "route.ts" | while read f; do
  routePath=$(echo "$f" | sed 's|app/api||;s|/route.ts||')
  matches=$(grep -rln "fetch.*['\"]/api${routePath}" app components features lib 2>/dev/null | wc -l)
  if [ "$matches" -eq "0" ]; then
    echo "ORPHAN: $routePath"
  fi
done
```

---

## Estimation gain potentiel

Si toutes les Phase 1-3 sont menées :
- **~30-50 fichiers source supprimés**
- **~5 000 lignes de code retirées**
- **2-3 packages npm économisés** (à confirmer via `depcheck`)
- Réduction du bundle JS final estimée : **3-7%**
- Amélioration Time to First Byte (TTFB) : marginale mais réelle

## Effort total estimé

**~5 jours-personne** pour les 3 phases avec revue par un dev senior.

Recommandation : faire **Phase 1** d'abord (quick wins low-risk), reporter Phase 2-3 après stabilisation des releases courantes.
