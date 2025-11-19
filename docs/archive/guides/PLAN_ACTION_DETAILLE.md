# Plan d'Action Détaillé - Améliorations Application

## 🔴 PRIORITÉ 1 : Corrections Critiques

### 1.1 Unification des Types Property

**Problème**: 3 définitions différentes de `PropertyType`

**Solution**:
```typescript
// lib/types/property-v3.ts
export type PropertyTypeV3 = /* ... */;

// lib/types/index.ts
/** @deprecated Utiliser PropertyTypeV3 */
export type PropertyType = PropertyTypeV3;

// lib/config/property-wizard-loader.ts
import type { PropertyTypeV3 as PropertyType } from "@/lib/types/property-v3";
```

**Fichiers à modifier**:
- `lib/types/index.ts` : Ajouter alias + deprecated
- `lib/config/property-wizard-loader.ts` : Importer depuis V3
- Tous les fichiers utilisant `PropertyType` : Vérifier compatibilité

**Estimation**: 2-3 heures

---

### 1.2 Réduction de l'usage de `any`

**Problème**: 164 occurrences de `any`, principalement dans routes API

**Solution**:
```typescript
// lib/supabase/typed-helpers.ts
import { Database } from "./database.types";

export function typedEq<T extends keyof Database['public']['Tables']>(
  column: string,
  value: Database['public']['Tables'][T]['Row'][keyof Database['public']['Tables'][T]['Row']]
) {
  return { column, value };
}

// Utilisation
.eq("id", typedEq("properties", params.id))
```

**Fichiers prioritaires**:
1. `app/api/properties/route.ts` (30 occurrences)
2. `app/api/properties/[id]/route.ts` (39 occurrences)
3. `app/api/properties/[id]/rooms/route.ts` (14 occurrences)

**Estimation**: 1-2 jours

---

### 1.3 Système de Logging Structuré

**Solution**:
```typescript
// lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isDev = process.env.NODE_ENV === 'development';
  
  debug(...args: any[]) {
    if (this.isDev) console.log('[DEBUG]', ...args);
  }
  
  info(...args: any[]) {
    if (this.isDev) console.info('[INFO]', ...args);
  }
  
  warn(...args: any[]) {
    console.warn('[WARN]', ...args);
  }
  
  error(...args: any[]) {
    console.error('[ERROR]', ...args);
    // TODO: Envoyer à Sentry
  }
}

export const logger = new Logger();
```

**Migration**:
```typescript
// Avant
console.log(`[POST /api/properties] Création draft...`);

// Après
logger.debug('Creating draft property', { type_bien: payload.type_bien });
```

**Estimation**: 1 jour

---

## 🟡 PRIORITÉ 2 : Améliorations Architecture

### 2.1 Unification Validation

**Solution**: Utiliser Zod uniquement avec `.superRefine()` pour validations complexes

```typescript
// lib/validations/property-v3.ts
export const propertySchemaV3 = propertySchemaV3Base.superRefine((data, ctx) => {
  // Validations métier complexes
  if (data.type_bien === "appartement") {
    if (!data.surface_habitable_m2 || data.surface_habitable_m2 <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["surface_habitable_m2"],
        message: "Surface obligatoire pour un appartement",
      });
    }
  }
});

// lib/validations/property-validation.ts (garder uniquement pour UI)
export function getValidationErrors(property: any, rooms: any[], photos: any[]) {
  // Convertir erreurs Zod en format UI-friendly
  const result = propertySchemaV3.safeParse(property);
  if (!result.success) {
    return {
      fieldErrors: result.error.flatten().fieldErrors,
      globalErrors: result.error.errors.filter(e => !e.path.length).map(e => e.message),
    };
  }
  return { isValid: true, fieldErrors: {}, globalErrors: [] };
}
```

**Estimation**: 2-3 jours

---

### 2.2 Migration Complète vers React Query

**Solution**: Remplacer tous les appels directs aux services

```typescript
// ❌ Avant
const handleSubmit = async () => {
  await propertiesService.submitProperty(id);
};

// ✅ Après
const { mutate: submitProperty } = useMutation({
  mutationFn: (id: string) => propertiesService.submitProperty(id),
  onSuccess: () => {
    queryClient.invalidateQueries(['properties']);
    toast({ title: "Succès" });
  },
});

const handleSubmit = () => {
  submitProperty(id);
};
```

**Fichiers à migrer**:
- Tous les composants avec `useState` + `useEffect` + appels API
- `features/properties/components/property-card.tsx`
- `features/properties/components/property-form.tsx`

**Estimation**: 3-4 jours

---

### 2.3 Middleware d'Authentification

**Solution**:
```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function middleware(request: NextRequest) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  // Routes protégées
  if (request.nextUrl.pathname.startsWith('/app/')) {
    if (!session) {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }
  }
  
  // Routes admin
  if (request.nextUrl.pathname.startsWith('/admin/')) {
    if (!session) {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }
    // Vérifier rôle admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();
    
    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/app/owner', request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/admin/:path*'],
};
```

**Estimation**: 1 jour

---

## 🟢 PRIORITÉ 3 : UI/UX SOTA 2025

### 3.1 Skeletons Contextuels

**Solution**:
```typescript
// components/ui/skeleton-card.tsx
export function SkeletonCard({ variant = "default" }: { variant?: "property" | "invoice" | "default" }) {
  const variants = {
    property: "h-64",
    invoice: "h-32",
    default: "h-24",
  };
  
  return (
    <div className={`${variants[variant]} animate-pulse rounded-lg bg-muted`}>
      <div className="h-4 w-3/4 bg-muted-foreground/20 rounded mb-2" />
      <div className="h-4 w-1/2 bg-muted-foreground/20 rounded" />
    </div>
  );
}

// Utilisation
{isLoading ? (
  <SkeletonCard variant="property" />
) : (
  <PropertyCard property={property} />
)}
```

**Estimation**: 2-3 heures

---

### 3.2 Dark Mode

**Solution**:
```typescript
// app/providers/theme-provider.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

// app/layout.tsx
import { ThemeProvider } from "./providers/theme-provider";

<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

**Estimation**: 1 jour

---

### 3.3 Optimistic Updates

**Solution**:
```typescript
// lib/hooks/use-properties-optimistic.ts (déjà créé, à compléter)
export function useUpdatePropertyOptimistic() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateProperty,
    onMutate: async (newData) => {
      await queryClient.cancelQueries(['properties', newData.id]);
      const previous = queryClient.getQueryData(['properties', newData.id]);
      
      queryClient.setQueryData(['properties', newData.id], (old: any) => ({
        ...old,
        ...newData,
      }));
      
      return { previous };
    },
    onError: (err, newData, context) => {
      queryClient.setQueryData(['properties', newData.id], context?.previous);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour",
        variant: "destructive",
      });
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries(['properties', variables.id]);
    },
  });
}
```

**Estimation**: 2 jours

---

### 3.4 Virtual Scrolling pour Listes

**Solution**:
```typescript
// components/virtual-list.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

export function VirtualList<T>({ items }: { items: T[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });
  
  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {/* Render item */}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Estimation**: 1 jour

---

### 3.5 Accessibilité Complète

**Solution**:
```typescript
// hooks/use-focus-trap.ts
import { useEffect, useRef } from 'react';

export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    
    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };
    
    container.addEventListener('keydown', handleTab);
    firstElement?.focus();
    
    return () => {
      container.removeEventListener('keydown', handleTab);
    };
  }, [isActive]);
  
  return containerRef;
}

// Utilisation dans Modal
const modalRef = useFocusTrap(isOpen);
```

**Estimation**: 2-3 jours

---

## 📊 MÉTRIQUES DE SUCCÈS

### Objectifs Phase 1 (1 mois)
- [ ] Réduction `any` : 164 → < 50 occurrences
- [ ] Logs nettoyés : 115 → 0 en production
- [ ] Types unifiés : 3 → 1 définition
- [ ] Dark mode : 0% → 100% support

### Objectifs Phase 2 (2-3 mois)
- [ ] React Query : 60% → 100% migration
- [ ] Validation : 2 systèmes → 1 système (Zod)
- [ ] Tests : 0% → 60% coverage
- [ ] Performance : Lighthouse 70 → 90+

### Objectifs Phase 3 (6 mois)
- [ ] Accessibilité : WCAG AA compliance
- [ ] Monitoring : Sentry intégré
- [ ] Documentation : Storybook complet
- [ ] Bundle size : -30%

---

## 🛠️ OUTILS RECOMMANDÉS

### Développement
- **ESLint** : Déjà configuré ✅
- **Prettier** : À configurer
- **Husky** : Pre-commit hooks
- **lint-staged** : Lint seulement fichiers modifiés

### Tests
- **Vitest** : Tests unitaires (déjà mentionné)
- **Playwright** : Tests E2E (déjà mentionné)
- **Testing Library** : Tests composants React

### Monitoring
- **Sentry** : Error tracking
- **Vercel Analytics** : Performance monitoring
- **Posthog** : Product analytics

### Documentation
- **Storybook** : Documentation composants
- **TypeDoc** : Documentation TypeScript
- **MDX** : Documentation interactive

---

## 📝 CHECKLIST MIGRATION

### Types Property
- [ ] Créer alias `PropertyType = PropertyTypeV3`
- [ ] Marquer legacy comme deprecated
- [ ] Migrer `property-wizard-loader.ts`
- [ ] Migrer tous les composants
- [ ] Supprimer définitions legacy

### Validation
- [ ] Migrer validations custom vers Zod `.superRefine()`
- [ ] Garder fonctions custom uniquement pour UI
- [ ] Centraliser messages d'erreur
- [ ] Tester tous les cas

### React Query
- [ ] Identifier tous les appels directs services
- [ ] Créer hooks `useMutation` manquants
- [ ] Migrer composants un par un
- [ ] Implémenter optimistic updates
- [ ] Tester cache invalidation

---

## 🎯 PROCHAINES ÉTAPES IMMÉDIATES

1. **Cette semaine** :
   - Unifier types Property
   - Créer système de logging
   - Réduire `any` dans routes properties

2. **Semaine prochaine** :
   - Implémenter dark mode
   - Migrer validation vers Zod uniquement
   - Créer middleware auth

3. **Mois suivant** :
   - Migration React Query complète
   - Optimistic updates
   - Tests unitaires de base

