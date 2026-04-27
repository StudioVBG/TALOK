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

## Migration des anciens specs

Les specs créés avant le refactor partagent ces problèmes :

- credentials hardcodés (`contact.explore.mq@gmail.com`, etc.) ;
- helper `login()` réimplémenté dans chaque fichier ;
- mix d'env vars `TEST_*` et `E2E_*` ;
- routes obsolètes (`/login` au lieu de `/auth/signin`, `/owner/money` qui a
  été déplacé, etc.) ;
- selecteurs fragiles (mélange `data-testid` + texte localisé).

**Specs déjà migrés** : `auth.spec.ts`, `accounting-flow.spec.ts`.

**À migrer** (par ordre de valeur décroissante) :

1. `critical-flows.spec.ts` (5 occurrences login)
2. `tenant-flow.spec.ts` (5 occurrences login)
3. `complete-journey.spec.ts`
4. `lease-flow.spec.ts`
5. `building-creation.spec.ts`
6. `document-center.spec.ts`
7. `add-property-flow.spec.ts`
8. `properties.spec.ts`, `property-wizard.spec.ts`, `property-type-selection.spec.ts`
9. `invoices.spec.ts`, `payments.spec.ts`
10. `meters-api.spec.ts`, `security-audit.spec.ts`
11. `onboarding.spec.ts`, `password-recovery.spec.ts`

Pour migrer un spec, suivre cette checklist :

- [ ] Remplacer `import { test, expect } from "@playwright/test"` par
      `import { test, expect } from "./fixtures/auth"` (si le test suppose un
      utilisateur authentifié).
- [ ] Supprimer le `beforeEach` qui appelle `login()` ; consommer la fixture
      `ownerPage` / `tenantPage` / `adminPage`.
- [ ] Remplacer les URLs hardcodées par `routes.*` (ajouter au catalogue si
      manquant).
- [ ] Supprimer les fonctions `login()` locales.
- [ ] Supprimer toute référence à des emails/mots de passe en clair.
- [ ] Vérifier que les sélecteurs ne pointent pas vers des routes obsolètes
      (`/owner/money` → `/owner/finances`, `/agency/accounting/balance` →
      `/owner/accounting/balance`, etc.).

## Tests unitaires

Vitest avec MSW pour mock du réseau. Setup dans `tests/setup.ts`.

```bash
npm run test:unit          # mode watch
npm run test:unit:run      # un seul run
```
