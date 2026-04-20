# Talok — SEO Action Plan

Site : https://talok.fr/ · Date : 2026-04-20 · Score actuel : **42/100**

Priorité : **Critical** = fix immédiat (bloque l'indexation) · **High** = <1 semaine · **Medium** = <1 mois · **Low** = backlog.

---

## 🔴 CRITICAL (bloque l'indexation — à fixer **cette semaine**)

### C1 — Supprimer le `<meta name="robots" content="noindex">` fantôme
**Problème :** toutes les pages testées (`/pricing`, `/blog`, `/faq`, `/solutions/*`, `/a-propos`) contiennent 2 balises robots, `noindex` en premier. Google prend la plus restrictive → **risque de désindexation de tout le site hors home**.
**Fix :** chercher dans le layout Next.js (probablement `app/layout.tsx` ou un `Head` partagé) un `metadata.robots` ou `<meta name="robots" content="noindex">` conditionnel qui fuite en prod. Retirer la duplication.
**Effort :** 30 min – 1 h. **Impact :** énorme (indexation).

### C2 — Corriger les canonicals qui pointent vers la home
**Problème :** `/blog`, `/solutions/investisseurs`, `/a-propos` (et probablement tous les `/solutions/*`) ont `<link rel="canonical" href="https://talok.fr/">`. Google consolide ces pages dans la home → elles **n'apparaîtront jamais en SERP**.
**Fix :** dans chaque route Next.js (`app/solutions/[slug]/page.tsx`, `app/blog/page.tsx`, `app/a-propos/page.tsx`), définir `export const metadata = { alternates: { canonical: '/slug' } }`.
**Effort :** 1 h. **Impact :** énorme (récupère 7+ pages en SERP).

### C3 — Nettoyer le sitemap (11 URLs en 404 sur 26)
**Problème :** 42 % du sitemap pointe vers des 404 (`/comparatif/*`, `/logiciel-gestion-locative`, `/outils/quittance-loyer|modele-bail|calculateur-rentabilite|etat-des-lieux`, `/guide/*`). Impact négatif sur le trust Google + rapports GSC "Couverture / Exclue : 404" cassés.
**Fix :**
1. Retirer les 11 URLs 404 du sitemap.
2. Ajouter les pages réelles manquantes : `/fonctionnalites`, `/solutions/investisseurs`, `/solutions/dom-tom`, `/solutions/proprietaires-particuliers`, `/solutions/administrateurs-biens`, `/temoignages`, `/guides`, `/outils/calcul-rendement-locatif`.
3. Remplacer `/features` (308) par la cible finale `/fonctionnalites`.
4. Soit livrer les pages attendues (comparatifs, outils quittance/bail/EDL, guides), soit retirer définitivement les entrées.
**Effort :** 1 h pour le nettoyage ; la livraison des pages cibles = feature à part entière.
**Impact :** fort (santé de crawl + GSC).

### C4 — Corriger le SSR des pages hors home (pas de H1/H2 en HTML initial)
**Problème :** `/pricing`, `/blog`, `/faq`, `/solutions/*`, `/a-propos` renvoient un HTML initial avec ≤ 10 mots et aucun `<h1>`. Tout est rendu côté client. Les bots peuvent ne pas déclencher JS, et même Googlebot différera l'indexation.
**Fix :** vérifier que ces routes sont bien en Server Components ou avec `generateMetadata`. Éviter `"use client"` sur la racine de la page. Si données asynchrones, utiliser `async function Page()` + `fetch` côté serveur.
**Effort :** 2-4 h par page (dépend de la complexité actuelle).
**Impact :** énorme (ranking + rich results).

---

## 🟠 HIGH (impact ranking direct — sous 1 semaine)

### H1 — Ajouter JSON-LD `Organization` + `SoftwareApplication` + `WebSite`
**Où :** dans `app/layout.tsx` (global) + `app/page.tsx` (home).
**Exemple minimal `SoftwareApplication` :**
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Talok",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "Logiciel de gestion locative tout-en-un…",
  "offers": {"@type":"Offer","price":"0","priceCurrency":"EUR"},
  "aggregateRating": {"@type":"AggregateRating","ratingValue":"4.8","reviewCount":"..."}
}
</script>
```
**Effort :** 2 h. **Impact :** visibilité Knowledge Panel + AI Overviews.

### H2 — Corriger le H1 cassé de la home
**Problème :** `"TALOKLelogicieldeGestionLocative"` — mots collés car espaces supprimés par le CSS/markup.
**Fix :** dans le composant Hero, remettre des espaces dans le texte, ou ajouter un `<span>` séparé par un espace invisible (`&nbsp;`). Viser **un seul `<h1>`** par page — l'autre H1 (`"Une solution adoptée par chaque profil"`) doit devenir `<h2>`.
**Effort :** 30 min. **Impact :** mot-clé principal redevient lisible.

### H3 — Dédupliquer le suffixe "| Talok | Talok" sur `/pricing` et `/blog`
**Fix :** probablement un `metadata.title` qui contient déjà "| Talok" alors que le `metadata.title.template` ajoute "| Talok". Utiliser `metadata.title.absolute` ou ne pas concaténer manuellement.
**Effort :** 15 min.

### H4 — Décider du sort de `/faq`
`/faq` est en `noindex`. Soit :
- **Option A (recommandée) :** retirer le noindex, ajouter schema `FAQPage` (bénéfice AI citation même sans rich result Google).
- **Option B :** laisser en `noindex` ET retirer `/faq` du sitemap + retirer du menu.
**Effort :** 1 h. **Impact :** trafic informationnel "comment créer un bail", "signature électronique bail", etc.

### H5 — Créer `llms.txt` à la racine
Format simple type :
```
# Talok
> Logiciel de gestion locative français (ALUR, signature électronique, scoring IA, Open Banking)

## Docs
- [Tarifs](https://talok.fr/pricing)
- [Fonctionnalités](https://talok.fr/fonctionnalites)
- [Solutions investisseurs](https://talok.fr/solutions/investisseurs)
- [DROM](https://talok.fr/solutions/dom-tom)
```
**Effort :** 30 min. **Impact :** GEO (Perplexity, ChatGPT search, Claude citations).

### H6 — Créer les pages `/comparatif/rentila|smovin|hektor` (ou les retirer)
Elles sont dans le sitemap et typiquement très performantes sur les requêtes "Rentila alternative", "alternative à Smovin". Le skill `seo-competitor-pages` peut générer ces pages.
**Effort :** 2 j pour 3 pages bien faites.
**Impact :** trafic de comparaison à haute intention d'achat.

---

## 🟡 MEDIUM (optimisation — sous 1 mois)

### M1 — Construire le blog
`/blog` est actuellement un placeholder "bientôt disponible" mais il est dans le sitemap avec `priority: 0.8` et `changefreq: daily`. Incohérent.
- Soit **lancer le blog** avec 5-10 posts pillier (plan `/seo cluster "logiciel gestion locative"`).
- Soit **retirer `/blog` du sitemap** et du menu tant que vide.

### M2 — Durcir la sécurité HTTP
- HSTS : ajouter `; includeSubDomains; preload` après validation des sous-domaines.
- CSP : planifier la suppression de `'unsafe-inline'` et `'unsafe-eval'` (nonces ou hash).
- Retirer `x-powered-by: Next.js` et `x-xss-protection`.

### M3 — Audit des 10 fonts préchargées
10 `<link rel="preload" ... font.woff2>` sur la home = trop. Ne précharger que les 2 polices critiques du above-the-fold.
**Impact :** LCP/INP.

### M4 — Ajouter schema `BreadcrumbList` + `Product/Offer` sur `/pricing`
`/pricing` a 3 plans (gratuit, Pro, etc.). Un `Product` + `Offer` avec prix + `AggregateRating` est très lisible par Google.

### M5 — Pages "outils" (quittance, bail, EDL, calculatrice)
Les URLs sont dans le sitemap (toutes 404 sauf une). Ce sont des **mines à trafic** (recherche info intention achat). Soit livrer les outils, soit retirer les entrées.

### M6 — Variante WebP du logo
Logo en `.png` préchargé. Passer en WebP/AVIF (pour LCP + poids).

### M7 — Tester le rendu SSR avec `curl` dans la pipeline CI
Ajouter un test qui `curl` les 10 pages top, grep `<h1>` et `<meta robots>`. Empêche les régressions type C1/C2/C4 de revenir.

---

## 🔵 LOW (nice-to-have — backlog)

### L1 — Retirer le H3 "Pro" (label de plan) sur la home → `<span>`
### L2 — Ajouter `x-default` hreflang en prévision d'une v2 multilingue
### L3 — Mettre en place `drift baseline` pour surveiller les régressions SEO semaine après semaine (`/seo drift baseline https://talok.fr/`)
### L4 — Enrichir `/a-propos` avec signaux E-E-A-T (équipe, fondateurs, historique, presse)
### L5 — Créer `llms-full.txt` (version étendue pour les LLMs — documentation produit, glossaire gestion locative)
### L6 — Obtenir clés API Google + Moz et relancer l'audit complet avec données terrain
### L7 — Activer l'agent `seo-drift` avec un snapshot hebdomadaire automatisé

---

## Roadmap condensée

| Semaine | Objectif | Tickets |
|---|---|---|
| **S1** | Débloquer l'indexation | C1, C2, C3, H2, H3 |
| **S2** | Rendu SSR + schema | C4 (home+pricing+solutions), H1, H4, H5 |
| **S3** | Reste du SSR + assets | C4 (autres), M2, M3, M6 |
| **S4** | Contenu & compétitifs | H6 (3 comparatifs) ou M1 (lancement blog) |
| **S5+** | Itérer, mesurer | M4, M5, M7, baseline drift |

---

## KPI de suivi (à mettre en place)

1. **Pages indexées** (GSC) : objectif +20 pages en 4 semaines (vs home seule aujourd'hui)
2. **Impressions organiques** (GSC) : objectif +50 % M+1
3. **SEO Health Score** (ce skill) : viser 70/100 à S+4, 85/100 à S+8
4. **Sitemap coverage** : 0 URL en 404 sous 72h
5. **Core Web Vitals** (CrUX) : mobile pass à 75% des URLs sous 30 j

---

## Commandes `/seo` utiles à chaque itération

```
# Après chaque déploiement majeur :
/seo technical https://talok.fr/
/seo page https://talok.fr/pricing
/seo schema https://talok.fr/

# Suivi régression :
/seo drift baseline https://talok.fr/         # une fois aujourd'hui
/seo drift compare  https://talok.fr/         # à chaque release

# Quand clés Google + Moz ajoutées :
/seo google full https://talok.fr/
/seo backlinks https://talok.fr/

# Stratégie contenu :
/seo cluster "logiciel gestion locative"
/seo plan saas
```
