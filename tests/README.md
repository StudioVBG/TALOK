# Tests Talok

## Couches

```
tests/
├── e2e/                       # Tests end-to-end (Playwright)
│   ├── fixtures/
│   │   └── auth.ts            # Fixtures `ownerPage`, `tenantPage`, `adminPage`
│   ├── helpers/
│   │   ├── credentials.ts     # Source unique de vérité pour les creds (env vars)
│   │   ├── routes.ts          # Catalogue des routes applicatives
│   │   └── login.ts           # Login helper (utilisé par global-setup et auth.spec)
│   ├── global-setup.ts        # Pré-authentifie chaque rôle, persiste storage state
│   ├── .auth/                 # Storage states générés (gitignored)
│   ├── auth.spec.ts           # Tests du flux de login lui-même
│   ├── accounting-flow.spec.ts
│   └── ... (autres specs)
├── unit/                      # Tests unitaires (Vitest)
└── README.md
```

## Variables d'environnement requises

Toutes les credentials de test sont injectées via env vars. Aucun fallback
hardcodé : un test qui n'a pas ses creds échoue à l'initialisation, ce qui
évite de pousser silencieusement des comptes prod dans CI.

```env
# .env.test (ou .env.local pour exécution locale)
E2E_OWNER_EMAIL=...
E2E_OWNER_PASSWORD=...
E2E_TENANT_EMAIL=...
E2E_TENANT_PASSWORD=...
E2E_ADMIN_EMAIL=...
E2E_ADMIN_PASSWORD=...

# Optionnel — base URL si vous testez contre un serveur déjà démarré
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000
```

## Lancer les tests

```bash
# Tous les tests E2E (build + start automatiques via webServer)
npm run test:e2e

# Contre un serveur déjà démarré sur :3000
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:prod

# Un fichier précis
npm run test:e2e -- accounting-flow.spec.ts

# Tests unitaires
npm run test:unit
```

## Pattern recommandé pour un nouveau spec

```ts
import { test, expect } from "./fixtures/auth";
import { routes } from "./helpers/routes";

test("owner peut consulter sa balance", async ({ ownerPage: page }) => {
  await page.goto(routes.owner.accounting.balance);
  await expect(
    page.getByRole("heading", { name: /Balance générale/i }),
  ).toBeVisible();
});
```

Points clés :

- **Pas de login dans `beforeEach`** : la fixture `ownerPage` (ou `tenantPage`,
  `adminPage`) fournit une page déjà authentifiée via storage state.
- **Pas de credentials en dur** : tout passe par `helpers/credentials.ts`.
- **Pas d'URL en dur** : utilisez le catalogue `helpers/routes.ts`.
- **Si vous testez le flux de login lui-même** : importez `test` depuis
  `@playwright/test` (pas depuis les fixtures auth) et utilisez `login()` de
  `helpers/login.ts`.

## Comment fonctionne le storage state

`global-setup.ts` se lance une seule fois avant la suite : il connecte chaque
rôle disponible (selon les env vars présentes) et persiste cookies + local
storage dans `tests/e2e/.auth/<role>.json`. Chaque fixture ouvre ensuite un
contexte navigateur pré-chargé avec ce fichier. Résultat : zéro re-login par
test, beaucoup moins de flakiness.

Les fichiers `.auth/*.json` sont **gitignored** — ils contiennent des sessions
authentifiées.

## État de la migration

**Tous les specs ont été migrés** vers le nouveau pattern (fixtures auth,
routes catalog, credentials centralisés). Plus aucun email/mot de passe en
dur, plus aucun helper `login()` local, plus aucune URL hardcodée.

| Spec | Pattern utilisé |
|------|-----------------|
| `auth.spec.ts` | `test` brut + `login()` (teste le flux de login) |
| `accounting-flow.spec.ts` | `ownerPage` |
| `critical-flows.spec.ts` | `ownerPage` + `test` brut (redirections) |
| `tenant-flow.spec.ts` | `tenantPage` + `test` brut (login form) |
| `complete-journey.spec.ts` | `ownerPage` (mode serial) + `request` |
| `lease-flow.spec.ts` | `ownerPage` |
| `building-creation.spec.ts` | `ownerPage` |
| `document-center.spec.ts` | `tenantPage` |
| `add-property-flow.spec.ts` | `ownerPage` + `request` |
| `properties.spec.ts` | `ownerPage` |
| `property-wizard.spec.ts` | `ownerPage` |
| `property-type-selection.spec.ts` | `ownerPage` |
| `invoices.spec.ts` | `ownerPage` |
| `payments.spec.ts` | `tenantPage` |
| `meters-api.spec.ts` | `ownerRequest` (APIRequestContext authentifié) + `request` brut |
| `security-audit.spec.ts` | `request` brut (tests sans auth) |
| `onboarding.spec.ts` | `test` brut (parcours signup public) |
| `password-recovery.spec.ts` | `test` brut (pages publiques) |

### Fixture `ownerRequest`

Pour les tests d'API qui nécessitent une session, utilise `ownerRequest` :

```ts
import { test, expect } from "./fixtures/auth";

test("appel d'une API protégée", async ({ ownerRequest }) => {
  const res = await ownerRequest.get("/api/meters/.../readings");
  expect(res.status()).toBe(200);
});
```

C'est un `APIRequestContext` Playwright pré-chargé avec le storage state du
rôle, ce qui injecte les cookies de session automatiquement. Plus besoin de
faire un login programmatique avant chaque test API.

### Checklist pour un nouveau spec

- [ ] Importer `test, expect` depuis `./fixtures/auth` si authentification
      requise, sinon depuis `@playwright/test`.
- [ ] Consommer `ownerPage` / `tenantPage` / `adminPage` au lieu de `page`
      pour les tests authentifiés ; `ownerRequest` pour les API
      authentifiées.
- [ ] Utiliser `routes.*` du catalogue plutôt que des URLs en dur.
- [ ] Aucun email / mot de passe / token de test en clair dans le fichier.

## Tests unitaires

Vitest avec MSW pour mock du réseau. Setup dans `tests/setup.ts`.

```bash
npm run test:unit          # mode watch
npm run test:unit:run      # un seul run
```
