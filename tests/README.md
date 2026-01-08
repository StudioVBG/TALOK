# 🧪 Tests - Talok

## Sources et Justifications

### Tests E2E (Playwright)
- **Source**: https://playwright.dev/docs/intro
- **Justification**: Playwright est le framework de test E2E recommandé par Next.js pour tester les applications web complètes
- **Documentation**: https://playwright.dev/docs/test-intro

### Tests Unitaires (Vitest)
- **Source**: https://vitest.dev/guide/
- **Justification**: Vitest est le framework de test unitaire moderne, compatible avec Vite et Next.js
- **Documentation**: https://vitest.dev/guide/getting-started.html

### Dates de test: Octobre et Novembre 2025
- **Source**: Date-fns - https://date-fns.org/docs/Getting-Started
- **Justification**: Tests avec des dates réelles pour valider le comportement de l'application avec des périodes spécifiques
- **Format**: `yyyy-MM` (ex: `2025-10`, `2025-11`)

### Supabase
- **Source**: https://supabase.com/docs/guides/auth
- **Justification**: Tests réels avec la base de données Supabase pour valider les intégrations
- **Documentation RLS**: https://supabase.com/docs/guides/auth/row-level-security

## Structure des tests

```
tests/
├── e2e/              # Tests end-to-end (Playwright)
│   ├── auth.spec.ts
│   ├── properties.spec.ts
│   ├── invoices.spec.ts
│   ├── payments.spec.ts
│   └── onboarding.spec.ts
├── unit/             # Tests unitaires (Vitest)
│   ├── date-utils.test.ts
│   ├── pagination.test.ts
│   └── rate-limit.test.ts
└── README.md
```

## Commandes

### Lancer tous les tests
```bash
npm test
```

### Lancer les tests E2E
```bash
npm run test:e2e
```

### Lancer les tests unitaires
```bash
npm test -- unit
```

### Lancer un test spécifique
```bash
npm run test:e2e -- auth.spec.ts
```

## Credentials de test

⚠️ **IMPORTANT**: Ces credentials sont réels et utilisent de vrais comptes Supabase.

- **Admin**: `support@talok.fr` / `Test12345!2025`
- **Propriétaire**: `contact.explore.mq@gmail.com` / `Test12345!2025`
- **Locataire**: `garybissol@yahoo.fr` / `Test12345!2025`

## Dates de test

Tous les tests utilisent des dates réelles d'octobre et novembre 2025:
- **Octobre 2025**: `2025-10`
- **Novembre 2025**: `2025-11`

## Tests réels vs Mocks

✅ **Tests réels**: 
- Connexion à Supabase
- Authentification réelle
- Création de données réelles
- Vérification des permissions RLS

❌ **Pas de mocks**:
- Pas de données fictives
- Pas de simulation d'API
- Pas de base de données en mémoire

## Configuration requise

1. **Variables d'environnement** (`.env.local`):
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

2. **Serveur de développement**:
```bash
npm run dev
```

3. **Base de données Supabase**:
- Migrations appliquées
- RLS activé
- Comptes de test créés

## Exécution des tests

### 1. Tests unitaires (rapides)
```bash
npm test
```

### 2. Tests E2E (plus longs)
```bash
npm run test:e2e
```

### 3. Tests en mode watch
```bash
npm test -- --watch
```

## Résultats attendus

### Tests unitaires
- ✅ Tous les tests de dates passent
- ✅ Pagination fonctionne correctement
- ✅ Rate limiting bloque après la limite

### Tests E2E
- ✅ Connexion réussie pour tous les rôles
- ✅ Création de logements fonctionne
- ✅ Factures d'octobre et novembre 2025 créées
- ✅ Paiements filtrés par période
- ✅ Pagination visible si > 12 items

## Notes importantes

1. **Tests réels**: Les tests créent de vraies données dans Supabase
2. **Nettoyage**: Les données de test peuvent être nettoyées manuellement
3. **Isolation**: Chaque test est indépendant
4. **Dates**: Tous les tests utilisent octobre/novembre 2025

## Références

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Vitest Documentation](https://vitest.dev/guide/)
- [Date-fns Documentation](https://date-fns.org/docs/Getting-Started)
- [Supabase Testing](https://supabase.com/docs/guides/auth)

