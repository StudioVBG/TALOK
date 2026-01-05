# RAPPORT D'ANALYSE COMPLET - DEPLOIEMENT NETLIFY 2026

## Gestion-Immo : Audit de configuration et problematiques

**Date**: 5 janvier 2026
**Version analysee**: Next.js 14.0.4
**Plugin Netlify**: @netlify/plugin-nextjs 5.15.3

---

## RESUME EXECUTIF

| Metrique | Valeur | Statut |
|----------|--------|--------|
| **Fichiers TypeScript/TSX** | 1 440+ | Attention: 419 avec `@ts-nocheck` |
| **Routes API** | 377 endpoints | OK |
| **Migrations Supabase** | 151 | OK |
| **Version Next.js** | 14.0.4 | Mise a jour recommandee |
| **Plugin Netlify** | 5.15.3 | OK |
| **Configuration Build** | Correcte | OK |

---

## PROBLEMES CRITIQUES IDENTIFIES

### 1. Dette Technique TypeScript Massive

**Gravite : CRITIQUE**

```
419 fichiers avec @ts-nocheck/@ts-ignore/@ts-expect-error
```

**Fichiers affectes** (extraits) :
- `app/layout.tsx` - Layout racine
- Tous les layouts portail (`/tenant`, `/owner`, `/provider`, etc.)
- 394 fichiers uniques

**Impact Netlify** :
- Le build passe grace a `ignoreBuildErrors: true` dans `next.config.js`
- **Risque** : Erreurs runtime non detectees qui peuvent crasher en production
- **Risque** : Les types Supabase ne sont pas verifies

**Configuration actuelle** (next.config.js:57-65):
```javascript
typescript: {
  ignoreBuildErrors: true, // DANGER
},
eslint: {
  ignoreDuringBuilds: true, // DANGER
},
```

**Recommandation** :
1. Corriger progressivement les fichiers critiques (layouts, API routes)
2. Mettre en place un budget technique de 5-10 fichiers/sprint
3. A terme, desactiver `ignoreBuildErrors`

---

### 2. Variables d'Environnement Non Documentees sur Netlify

**Gravite : CRITIQUE**

**Variables REQUISES a configurer dans Netlify UI** :

| Variable | Type | Status |
|----------|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | A configurer |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | A configurer |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | A configurer |
| `API_KEY_MASTER_KEY` | Secret | A configurer |
| `NEXT_PUBLIC_APP_URL` | Public | A configurer |

**Variables OPTIONNELLES mais utilisees** :

| Variable | Service | Fichiers qui l'utilisent |
|----------|---------|-------------------------|
| `OPENAI_API_KEY` | IA | 63+ fichiers API |
| `STRIPE_SECRET_KEY` | Paiements | webhooks, checkout |
| `RESEND_API_KEY` | Emails | notifications |
| `TWILIO_ACCOUNT_SID/AUTH_TOKEN` | SMS | sms.service.ts |
| `YOUSIGN_API_KEY` | Signatures | yousign.service.ts |
| `CRON_SECRET` | Crons securises | 10 routes cron |
| `NEXT_PUBLIC_SENTRY_DSN` | Monitoring | instrumentation.ts |
| `NEXT_PUBLIC_POSTHOG_KEY` | Analytics | posthog-provider.tsx |

**ALERTE SECURITE** :
Les routes cron (`/api/cron/*`) verifient `CRON_SECRET` mais autorisent l'acces si non defini en developpement. **En production sans cette variable, les crons sont accessibles publiquement**.

---

### 3. Routes Cron Non Protegees

**Gravite : HAUTE**

**10 routes cron identifiees** :
```
/api/cron/rent-reminders
/api/cron/generate-invoices
/api/cron/check-cni-expiry
/api/cron/irl-indexation
/api/cron/lease-expiry-alerts
/api/cron/notifications
/api/cron/subscription-alerts
/api/cron/refresh-analytics
/api/cron/process-outbox
/api/cron/generate-monthly-invoices
```

**Probleme** (rent-reminders/route.ts:14-21):
```typescript
function verifyCronSecret(request: Request): boolean {
  if (!process.env.CRON_SECRET) {
    console.warn("CRON_SECRET non configure - acces autorise en dev");
    return process.env.NODE_ENV === "development"; // FAUX EN PROD!
  }
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}
```

**Solution** :
1. **TOUJOURS** configurer `CRON_SECRET` sur Netlify
2. Utiliser Netlify Scheduled Functions au lieu de routes API exposees
3. Ou configurer un service externe (EasyCron) avec le secret

---

### 4. Configuration `force-dynamic` Globale

**Gravite : HAUTE**

**Situation** : Le layout racine force toutes les pages en dynamique :

```typescript
// app/layout.tsx:1-2
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

**Impact Netlify** :
- Aucune page n'est pre-rendue (SSG)
- Pas de mise en cache au niveau CDN edge
- Chaque requete declenche une fonction serverless
- **Cout** : Augmentation significative des invocations Netlify Functions

**Recommandation** :
- Supprimer `force-dynamic` du layout racine
- L'ajouter uniquement aux pages qui en ont besoin
- Utiliser `revalidate` pour ISR sur les pages semi-statiques

---

### 5. Version Next.js Obsolete

**Gravite : MOYENNE**

| Actuel | Stable | Recommande |
|--------|--------|------------|
| 14.0.4 | 15.x | 14.2.x ou 15.x |

**Problemes connus avec 14.0.x** :
- Bugs de cache avec App Router
- Skew protection instable
- Server Actions moins robustes

**Recommandation** :
```bash
npm install next@14.2.20
# Ou pour Next.js 15 :
npm install next@15.1.0
```

---

## PROBLEMES DE CONFIGURATION NETLIFY

### 1. Absence de Skew Protection

**Fichier** : `netlify.toml`

**Manquant** :
```toml
[build.environment]
  NETLIFY_NEXT_SKEW_PROTECTION = "true"
```

**Consequence** : Les utilisateurs actifs pendant un deploiement peuvent avoir des erreurs 500 dues a un decalage client/serveur.

---

### 2. Headers de Securite Incomplets

**Actuel** (netlify.toml:46-53):
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
```

**Manquant** :
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` cote Netlify (double avec next.config.js)

**Recommandation** :
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
```

---

### 3. Absence de Configuration Redirects

**Probleme** : Pas de gestion des anciennes URLs ou des chemins canoniques.

**Recommandation** (netlify.toml):
```toml
[[redirects]]
  from = "/app/*"
  to = "/:splat"
  status = 301
  force = true

[[redirects]]
  from = "/tenant/home"
  to = "/tenant/dashboard"
  status = 301
```

*(Note: le middleware gere ces redirections, mais les avoir dans Netlify est plus performant)*

---

## PROBLEMES DE DEPENDANCES

### 1. Conflit de Versions

| Package | Version | Probleme |
|---------|---------|----------|
| `framer-motion` | 12.23.24 | Duplique avec `motion` |
| `motion` | 12.23.24 | Supprimer l'un des deux |
| `@supabase/ssr` | 0.1.0 | Tres ancien |
| `zod` | 3.25.76 | Necessite un workaround webpack |

**Fix Zod** (deja en place mais fragile) :
```javascript
// next.config.js:71-78
webpack: (config) => {
  config.resolve.alias = {
    'zod': path.resolve(__dirname, 'node_modules/zod'),
    'zod/v3': path.resolve(__dirname, 'node_modules/zod'),
  };
  return config;
}
```

---

### 2. PWA Desactivee sur Netlify

**Configuration** (next.config.js:6-8):
```javascript
const withPWA = require('next-pwa')({
  disable: process.env.NETLIFY === 'true',
});
```

**Consequence** : Pas de service worker ni de cache offline sur Netlify.

**Recommandation** :
- Si PWA souhaitee, supprimer cette condition
- Tester les workers sur Netlify Functions

---

## ANALYSE DES ROUTES API

### Distribution par Runtime

| Runtime | Nombre | Pourcentage |
|---------|--------|-------------|
| `nodejs` | ~350 | 93% |
| `edge` | 0 | 0% |
| Non specifie | ~27 | 7% |

**Bonne pratique** : Utilisation exclusive du runtime Node.js, evitant les limitations Edge.

### Routes Sensibles Sans Protection

| Route | Risque | Recommandation |
|-------|--------|----------------|
| `/api/debug/*` | CRITIQUE | Desactiver en prod |
| `/api/dev/*` | CRITIQUE | Desactiver en prod |
| `/api/admin/*` | MOYENNE | Verifier auth dans chaque handler |

---

## ANALYSE SUPABASE

### Client Side vs Server Side

| Type | Fichier | Usage |
|------|---------|-------|
| Server avec cookies | `lib/supabase/server.ts` | Correct |
| Service Role | `lib/supabase/service-client.ts` | Singleton |
| Client browser | `lib/supabase/client.ts` | Non present ici |

### Singleton Service Client

**Potentiel probleme** : Le client service role est un singleton global.

```typescript
// service-client.ts:10
let serviceClient: ... | null = null;
```

Sur Netlify Functions, chaque invocation peut etre dans un container different. Le singleton est recree a chaque cold start, ce qui est OK, mais attention aux fuites memoire si le container est reutilise.

---

## METRIQUES DE PERFORMANCE POTENTIELLES

### Cold Start Estime

Avec 377 routes API et des dependances lourdes :
- **Estimation cold start** : 3-8 secondes
- **Packages lourds** : LangChain, OpenAI SDK, Tesseract.js, Sharp

**Optimisations possibles** :
1. Utiliser `optimizePackageImports` (deja fait)
2. Lazy loading des dependances IA
3. Separer les fonctions lourdes dans des Edge Functions Supabase

---

## POINTS POSITIFS

1. **Plugin Netlify Next.js** : Correctement configure (`@netlify/plugin-nextjs`)
2. **Middleware Edge-safe** : Pas d'import Supabase dans le middleware
3. **Cache statique** : Headers de cache corrects pour `/_next/static/*`
4. **Node version** : 20 LTS correctement specifiee
5. **CSP Headers** : Configuration securisee dans next.config.js
6. **Instrumentation Sentry** : Separation Node.js / Edge correcte

---

## CHECKLIST DE CONFIGURATION NETLIFY

### Variables d'Environnement a Configurer

```bash
# REQUIS
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
API_KEY_MASTER_KEY=<32+ caracteres>
NEXT_PUBLIC_APP_URL=https://votre-site.netlify.app

# SECURITE CRON
CRON_SECRET=<secret-fort>

# OPTIONNEL - Services
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
RESEND_API_KEY=re_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...

# MONITORING
NEXT_PUBLIC_SENTRY_DSN=https://...
NEXT_PUBLIC_POSTHOG_KEY=phc_...
```

### Modifications netlify.toml Recommandees

```toml
[build]
  command = "npm run build"

[build.environment]
  NODE_VERSION = "20"
  NPM_VERSION = "10"
  NETLIFY = "true"
  NETLIFY_NEXT_SKEW_PROTECTION = "true"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"

[[headers]]
  for = "/_next/static/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[redirects]]
  from = "/app/*"
  to = "/:splat"
  status = 301

[[redirects]]
  from = "/tenant/home"
  to = "/tenant/dashboard"
  status = 301
```

---

## PLAN D'ACTION PRIORITAIRE

### Urgence Immediate (Avant deploiement)

| Action | Fichier | Effort |
|--------|---------|--------|
| Configurer toutes les variables d'environnement | Netlify UI | 30 min |
| Ajouter `CRON_SECRET` | Netlify UI | 5 min |
| Ajouter `NETLIFY_NEXT_SKEW_PROTECTION=true` | netlify.toml | 2 min |

### Court Terme (1-2 semaines)

| Action | Impact |
|--------|--------|
| Mettre a jour Next.js vers 14.2.x | Stabilite |
| Supprimer `force-dynamic` du layout racine | Performance |
| Securiser routes `/api/debug/*` et `/api/dev/*` | Securite |

### Moyen Terme (1-2 mois)

| Action | Impact |
|--------|--------|
| Corriger 50+ fichiers @ts-nocheck critiques | Fiabilite |
| Implementer ISR sur pages semi-statiques | Performance |
| Migrer crons vers Netlify Scheduled Functions | Securite |

---

## SOURCES DOCUMENTATION NETLIFY 2026

- [Next.js on Netlify - Documentation officielle](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/)
- [Deploy Next.js 15 on Netlify](https://www.netlify.com/blog/deploy-nextjs-15/)
- [OpenNext Adapter Documentation](https://opennext.js.org/netlify)
- [Netlify Support Forums - App Router Issues](https://answers.netlify.com/t/404-on-all-pages-of-a-next-js-application-with-app-router-setup/93605)

---

*Rapport genere le 5 janvier 2026*
