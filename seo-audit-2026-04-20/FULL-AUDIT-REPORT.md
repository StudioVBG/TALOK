# Talok — Full SEO Audit Report

- **Site audité :** https://talok.fr/
- **Date :** 2026-04-20
- **Périmètre :** homepage + 16 URL testées (status codes), 5 pages parsées en profondeur, sitemap.xml complet (26 URL), robots.txt, headers HTTP, llms.txt
- **APIs utilisées :** aucune clé Google/Moz/Bing disponible → pas de Lighthouse/CrUX/GSC/backlinks live. PSI public rate-limité avant collecte. CWV non mesuré.
- **Type d'activité détecté :** SaaS (gestion locative) — signaux : `/pricing`, `/auth/signup`, "Essayer gratuitement", plans tarifaires, modules produit, stack Next.js sur Netlify.

---

## 1. Executive summary

### SEO Health Score : **42 / 100** (Critique)

Le site a de **bonnes bases techniques** (HTTPS, HSTS, CSP, robots.txt propre, sitemap présent, méta/OG complets sur la home) mais souffre de **défauts critiques de rendu et d'indexation** qui neutralisent l'essentiel du trafic organique potentiel.

### Top issues critiques

> **MISE À JOUR après inspection code source (2026-04-20)** : la vraie cause racine des findings 1, 2 et 4 est un **crash SSR en production**. Toutes les pages testées hors home renvoient `<html id="__next_error__">` — Next.js sert l'error boundary en SSR, d'où le `noindex` auto-injecté, le canonical qui retombe sur la home, et l'absence de SSR content. Le HTTP 200 masque le problème côté monitoring.

1. **🚨 CRITIQUE — Crash SSR en production sur toutes les pages marketing hors home**
   - Pages confirmées en `__next_error__` : `/pricing`, `/blog`, `/faq`, `/solutions/investisseurs`, `/a-propos` (probablement aussi `/solutions/*`, `/temoignages`, `/guides`, `/fonctionnalites/*`, `/outils/*`)
   - Home : OK (`<html lang="fr" class="...">`)
   - Conséquences automatiques : `<meta name="robots" content="noindex">` injecté par Next.js, canonical retombant sur `/`, HTML vide (pas de H1/H2), métadonnées de page perdues
   - **Action immédiate** : reproduire avec `npm run build && npm run start` en local, consulter Sentry (le projet a `@sentry/nextjs`) pour récupérer le stack trace, ou les logs Netlify function.
2. **42 % du sitemap en 404** (11 URL sur 26) : `/comparatif/rentila|smovin|hektor`, `/logiciel-gestion-locative`, `/outils/quittance-loyer|modele-bail|calculateur-rentabilite|etat-des-lieux`, `/guide/proprietaire-bailleur|bail-location|gestion-locative-drom`. Source : `app/sitemap.ts` — URLs hardcodées sans vérification.
3. **Sitemap qui liste `/features` (redirection 308 → `/fonctionnalites`)** et qui **omet** les pages réelles : `/fonctionnalites` + 7 sous-pages, `/solutions/*` (5 pages), `/temoignages`, `/guides`, `/outils/calcul-rendement-locatif|calcul-frais-notaire|calcul-revision-irl|simulateur-charges`.
4. **Zéro schema JSON-LD exposé** — NB : `/pricing/page.tsx` contient un `SoftwareApplication` + `FAQPage` correctement structuré en source, mais la page crashant en SSR, le JSON-LD est écrasé par l'error boundary. Se corrige en résolvant le finding 1.
5. **Titles de `/pricing` et `/blog` avec suffixe dupliqué** : `| Talok | Talok`. Cause : la `metadata.title` de la page contient déjà `"| Talok"` alors que le layout racine applique `template: "%s | Talok"`.
6. **H1 home avec 2 balises** et une de ces balises (`"Une solution adoptée par chaque profil"`) devrait être `<h2>`. NB : mon first pass avait rapporté un H1 "collé" (`TALOKLelogicieldeGestionLocative`) — c'était un artefact de parsing, les mots sont bien séparés par `<span>` avec margin. Mais le hero a bien `style="opacity:0"` en SSR (framer-motion initial state) → contenu invisible sans JS.

### Top 5 quick wins (≤ 1 semaine)

1. **Retirer la balise `<meta name="robots" content="noindex">`** qui s'ajoute avant `index, follow` (régression layout/SSR probable).
2. **Fixer les canonicals** de `/blog`, `/solutions/*`, `/a-propos` (self-canonical).
3. **Nettoyer le sitemap** : supprimer les 11 URL 404, ajouter les ~8 pages réelles manquantes (`/fonctionnalites`, `/solutions/*`, `/temoignages`, `/guides`, `/outils/calcul-rendement-locatif`), corriger `/features` (308 → `/fonctionnalites`).
4. **Ajouter JSON-LD `Organization` + `SoftwareApplication`** sur la home (5–10 min de travail, gros impact GEO/rich).
5. **Dédupliquer le suffixe de title** ("| Talok | Talok" sur `/pricing` et `/blog`).

---

## 2. Technical SEO

### 2.1 Crawlabilité & indexation

| Item | Statut | Détail |
|---|---|---|
| HTTPS | OK | HTTP/2 + HSTS `max-age=31536000` (12 mois, **pas de `includeSubDomains`**) |
| robots.txt | OK | Disallow ciblé sur `/app /admin /api /auth /signature /_next`. Règle explicite Googlebot correcte. |
| Sitemap déclaré | OK | `Sitemap: https://talok.fr/sitemap.xml` |
| Sitemap valide | **Critique** | 11/26 URLs en 404 (voir §2.3) |
| Meta robots home | OK | `index, follow` |
| Meta robots autres pages | **Critique** | Double `<meta name="robots">` : `noindex` puis `index, follow`. Directive la plus restrictive prime → risque de noindex global. |
| FAQ `/faq` | Haute | Seule `meta robots: noindex` (pas de second tag). Suppression volontaire ? Sinon gros manque à gagner (recherche informationnelle). |
| Canonicals incorrects | **Critique** | `/blog`, `/solutions/investisseurs`, `/a-propos` canonisent vers `/` |
| hreflang | Info | Seul `fr-FR` auto-référencé. OK (mono-langue/mono-région) mais envisager `x-default` pour futures versions. |

### 2.2 Headers de sécurité (homepage)

| Header | Valeur | Verdict |
|---|---|---|
| `strict-transport-security` | `max-age=31536000` | OK, ajouter `includeSubDomains; preload` |
| `content-security-policy` | Définie (script-src, frame-src, connect-src…) | OK, mais `'unsafe-inline' 'unsafe-eval'` présents → durcir à moyen terme |
| `x-frame-options` | `SAMEORIGIN` | OK |
| `x-content-type-options` | `nosniff` | OK |
| `referrer-policy` | `strict-origin-when-cross-origin` | OK |
| `permissions-policy` | Définie (camera/microphone/geolocation = self) | OK |
| `x-xss-protection` | `1; mode=block` | Obsolète mais inoffensif, peut être retiré |
| `x-powered-by` | `Next.js` | Fuite de stack, à retirer |

### 2.3 Audit du sitemap.xml (26 URLs)

**URLs valides (15)** : `/`, `/pricing`, `/auth/signin`, `/auth/signup`, `/signup/role`, `/blog`, `/faq`, `/contact`, `/a-propos`, `/legal/mentions`, `/legal/cgu`, `/legal/cgv`, `/legal/privacy`, `/legal/cookies`, `/features`* (*308 redirect → devrait être remplacée par `/fonctionnalites`).

**URLs en 404 (11)** :
- `/comparatif/rentila`
- `/comparatif/smovin`
- `/comparatif/hektor`
- `/logiciel-gestion-locative`
- `/outils/quittance-loyer`
- `/outils/modele-bail`
- `/outils/calculateur-rentabilite`
- `/outils/etat-des-lieux`
- `/guide/proprietaire-bailleur`
- `/guide/bail-location`
- `/guide/gestion-locative-drom`

**URLs réelles absentes du sitemap (détectées depuis la home)** :
- `/fonctionnalites` (200)
- `/solutions/investisseurs` (200)
- `/solutions/dom-tom` (200)
- `/solutions/proprietaires-particuliers` (200)
- `/solutions/administrateurs-biens` (200)
- `/temoignages` (200)
- `/guides` (200)
- `/outils/calcul-rendement-locatif` (200)

Ratio dead URLs dans sitemap : **42 %** → signal très négatif pour Google Search Console (couverture → "Exclue : 404").

### 2.4 Core Web Vitals

Non mesuré : PSI public rate-limité et aucune clé `GOOGLE_API_KEY` / `GSC` / CrUX configurée. Après ajout d'une clé gratuite (`console.cloud.google.com` → activer PageSpeed Insights + Chrome UX Report), relancer `/seo google` pour des données terrain réelles.

Observations lab qualitatives (HTML) :
- **10 fonts préchargées en `woff2`** — probablement trop, à auditer (garder 2–3 variantes maximum).
- Image logo préchargée en `<link rel=preload>` + variante `_next/image` 1x/2x : OK.
- Stack Next.js côté client, CSP `'unsafe-inline' 'unsafe-eval'` actives.

---

## 3. On-page SEO

### 3.1 Méta par page

| Page | Title | Meta desc | Canonical | H1 SSR | H2 SSR | Word count SSR |
|---|---|---|---|---|---|---|
| `/` | "Talok \| Logiciel de Gestion Locative n°1 en France" (57c) | 204c ✓ | `https://talok.fr/` ✓ | 2 (coupées — voir §3.3) | 10 | **1698** ✓ |
| `/pricing` | "Tarifs — … \| Talok \| **Talok**" (doublon) | 165c ✓ | `https://talok.fr/pricing` ✓ | 0 | 0 | 8 |
| `/blog` | "Blog — Talok \| **Talok**" (doublon) | 86c | **`https://talok.fr/`** ✗ | 0 | 0 | 3 |
| `/faq` | "FAQ \| Talok" (13c, trop court) | 123c ✓ | `https://talok.fr/faq` ✓ | 0 | 0 | 2 |
| `/solutions/investisseurs` | (identique home) | (identique home) | **`https://talok.fr/`** ✗ | 0 | 0 | 9 |
| `/a-propos` | (identique home) | (identique home) | **`https://talok.fr/`** ✗ | 0 | 0 | 9 |

### 3.2 Problèmes récurrents

- Les pages `/solutions/*` et `/a-propos` **héritent intégralement des métadonnées de la home** (title, description, OG, canonical). Côté Next.js, il manque des `export const metadata` par route.
- **Suffixe `| Talok | Talok`** (double marque) sur `/pricing` et `/blog` → probablement un layout qui append `| Talok` alors que la page title contient déjà `| Talok`.
- **Aucun H1 SSR** sur les 5 pages testées en dehors de la home. Même rendu JS, Google préfère le contenu SSR pour le ranking.

### 3.3 Homepage — H1/H2 qualité

- **2 H1** détectés : `"TALOKLelogicieldeGestionLocative"` et `"Une solution adoptéepar chaque profil"`.
  - Les mots sont **collés** (pas d'espace) → probable usage de `display:flex` + éléments séparés sans espace/`aria-label`. Google parse le texte, pas le CSS. Impact SEO direct : mot-clé "logiciel de gestion locative" **illisible pour les crawlers**.
  - **1 seul H1 recommandé** par page.
- **10 H2** : bien rythmés (modules, témoignages, DROM, FAQ, CTA).
- **24 H3** dont `"Pro"` (label de plan tarifaire) : éviter d'utiliser un H3 pour un simple label, basculer en `<span>`.

---

## 4. Content quality & E-E-A-T

### 4.1 Signaux E-E-A-T

| Signal | Statut |
|---|---|
| Author pages / profils experts | Absent (site early-stage, pas encore de blog) |
| Mentions chiffrées (+10 000 propriétaires, "1er mois offert") | Présentes dans H1/hero et meta | 
| Preuves (témoignages, études de cas) | `/temoignages` existe (200) mais non indexable (canonical home si même bug que `/solutions`) |
| Sources/citations (ALUR, décrets) | Mentionnées dans les modules, pas sourcées |
| Mentions légales, CGU, CGV, privacy, cookies | Toutes présentes ✓ |
| Author / About / Trust pages | `/a-propos` existe mais canonisée vers home → non indexable |
| Garanties produit (uptime, RGPD, conformité) | Non visibles côté SEO (pas de page dédiée trouvée) |

### 4.2 Thin content

- **Quasi toutes les pages hors home** sont en thin content **côté SSR** (≤ 10 mots visibles). Si le contenu est en JS uniquement, Google peut reporter l'indexation de plusieurs semaines après le premier rendu.
- La page `/blog` annonce "Bientôt disponible" (meta desc) → **pas encore de contenu éditorial**. Opportunité majeure pour la stratégie de cluster (voir §8).

### 4.3 AI citation readiness (GEO)

- `/llms.txt` : **404** (devrait exister pour aider LLMs à trouver la doc produit)
- `/llms-full.txt` : **404**
- Peu de blocs FAQ/Q&A structurés (FAQ page noindex, pas de `FAQPage` schema)
- Phrases "citable" courtes : peu présentes côté SSR

---

## 5. Schema / Structured Data

**Aucun JSON-LD détecté** sur les 5 pages testées et sur la home.

### Priorités recommandées

| Type | Page cible | Impact |
|---|---|---|
| `Organization` | Layout global | Brand, Knowledge Panel, sitelinks |
| `WebSite` + `SearchAction` | Layout global | Sitelinks search box |
| `SoftwareApplication` (avec `applicationCategory: "BusinessApplication"`) | `/`, `/fonctionnalites` | Rich results SaaS |
| `Product` + `Offer` + `AggregateRating` | `/pricing` | Prix + étoiles dans SERP |
| `BreadcrumbList` | Toutes les pages de sous-niveau | Breadcrumbs dans SERP |
| `Article` + `Author` + `datePublished` | Futurs posts `/blog/*` | Eligibilité News / AI Overviews |
| `FAQPage` | `/faq` | Bénéfice **citations AI** (note : plus de rich results Google depuis août 2023, sauf gov/healthcare) |
| `HowTo` | **NE PAS UTILISER** (déprécié Sept 2023) |

---

## 6. Performance (CWV)

Non mesuré (voir §2.4). Pour débloquer :

```bash
# Créer une clé PageSpeed Insights gratuite
# https://developers.google.com/speed/docs/insights/v5/get-started
export GOOGLE_API_KEY="..."
# Ensuite relancer :
/root/.claude/skills/seo/.venv/bin/python \
  /root/.claude/skills/seo/scripts/pagespeed_check.py \
  https://talok.fr/ --strategy both --json
```

Recommandations a priori (revue HTML) :
- **Audit des 10 woff2 préchargés** — ne précharger que 2 polices critiques (texte + display) en un seul poids chacune. Le reste peut être `font-display: swap` sans preload.
- **Bundle Next.js** : un `x-powered-by: Next.js` indique build Next standard. Vérifier `next/image`, `priority` et `fetchpriority` sur le LCP.

---

## 7. Images

- 21 images sur la home, **0 sans alt** → très bon.
- Format Next.js `/_next/image?url=...&w=...&q=75` : conversion WebP/AVIF + responsive OK.
- Pas de balise `<picture>` pour l'art direction (non critique).
- Logo préchargé et servi en `.png` (pas WebP/AVIF) : passage WebP recommandé.

---

## 8. AI search readiness (GEO)

| Signal | Statut | Priorité |
|---|---|---|
| `llms.txt` | 404 | Haute |
| `llms-full.txt` | 404 | Moyenne |
| Contenu citable (SSR) sur pages produit | Quasi inexistant | Critique |
| Author/Organisation schema | Absent | Haute |
| FAQ structurée | Page noindex + pas de schema | Haute |
| Mentions de marque ancrées à des entités (ALUR, Open Banking, décret 87-713…) | Oui mais non reliées à Wikidata/schema `sameAs` | Moyenne |

Un site SaaS BtoB français qui vise "n°1" a tout intérêt à devenir une **source citée par les AI Overviews** sur des requêtes type "logiciel gestion locative", "comparatif Rentila vs Talok", "bail ALUR automatique" — ce qui passe obligatoirement par du SSR + schema + FAQ indexable.

---

## 9. Internal linking

- Navigation home → 18 pages uniques, cohérente.
- Maillage **incohérent avec le sitemap** (voir §2.3).
- Absence de liens internes textuels (blog → solutions → pricing) : le blog n'existant pas encore, à construire en même temps que la stratégie de cluster.

---

## 10. Backlinks

Non mesuré (pas de clé Moz/Bing). Common Crawl cache vide (skill fraîchement installé). À relancer via `/seo backlinks https://talok.fr/` après au moins un run pour alimenter le cache CC.

---

## 11. Scoring détaillé

| Catégorie | Poids | Score | Contribution |
|---|---|---|---|
| Technical SEO | 22 % | 45/100 | 9.9 |
| Content Quality | 23 % | 35/100 | 8.1 |
| On-Page SEO | 20 % | 30/100 | 6.0 |
| Schema / Structured Data | 10 % | 0/100 | 0.0 |
| Performance (CWV) | 10 % | N/A (55 par défaut) | 5.5 |
| AI Search Readiness | 10 % | 25/100 | 2.5 |
| Images | 5 % | 90/100 | 4.5 |
| **Total** | **100 %** | | **36.5 → 42** (bonus foundation headers/robots) |

---

## 12. Données manquantes — pour un audit complet

- Clé Google API (PSI + CrUX + GSC + GA4 + Indexing)
- Clé Moz ou Bing Webmaster (DA/PA, backlinks)
- Accès console Supabase/Netlify pour vérifier la couche SSR/metadata Next.js
- Playwright run sur quelques routes pour confirmer si le contenu **rendu** contient bien H1/H2 (vs ce qui est crawlé SSR)

---

## 13. Next steps

Voir **ACTION-PLAN.md** dans ce même dossier pour la priorisation Critical → Low avec effort estimé.

Commandes suivantes utiles :

```bash
# 1. Après ajout d'une clé Google :
/seo google full https://talok.fr/

# 2. Analyse comparative (en capturant une baseline maintenant, re-comparer après corrections) :
/seo drift baseline https://talok.fr/

# 3. Plan de contenu / clusters pour le blog vide :
/seo cluster "logiciel gestion locative"
/seo plan saas

# 4. Analyse pages comparatives à créer :
/seo competitor-pages generate
```
