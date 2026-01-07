# 🚀 Plan de Réorganisation UI/UX - Talok

**Version :** 1.0  
**Date :** Novembre 2025  
**Priorité :** HAUTE

---

## 📁 Nouvelle Structure des Routes Proposée

### Architecture Cible

```
app/
├── (marketing)/                    # Pages publiques (landing, blog)
│   ├── page.tsx                    # Landing page
│   ├── blog/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx
│   ├── pricing/page.tsx
│   └── contact/page.tsx
│
├── (legal)/                        # Pages légales
│   ├── layout.tsx
│   ├── terms/page.tsx
│   └── privacy/page.tsx
│
├── (auth)/                         # Authentification
│   ├── layout.tsx                  # Layout auth (centré, minimaliste)
│   ├── signin/page.tsx
│   ├── signup/
│   │   ├── page.tsx
│   │   ├── role/page.tsx
│   │   └── verify-email/page.tsx
│   ├── reset-password/page.tsx
│   └── callback/page.tsx
│
├── (dashboard)/                    # Zone authentifiée
│   ├── layout.tsx                  # Layout commun (sidebar, header)
│   │
│   ├── owner/                      # 🏠 Propriétaire
│   │   ├── layout.tsx              # Layout owner (données + sidebar)
│   │   ├── page.tsx                # Dashboard
│   │   ├── properties/
│   │   │   ├── page.tsx            # Liste des biens
│   │   │   ├── new/page.tsx        # Créer un bien
│   │   │   └── [id]/
│   │   │       ├── page.tsx        # Détails du bien
│   │   │       └── edit/page.tsx   # Modifier
│   │   ├── leases/
│   │   │   ├── page.tsx            # Liste des baux
│   │   │   ├── new/page.tsx        # Créer un bail
│   │   │   └── [id]/page.tsx       # Détails du bail
│   │   ├── finances/
│   │   │   ├── page.tsx            # Vue finances
│   │   │   ├── invoices/page.tsx   # Factures
│   │   │   └── charges/page.tsx    # Charges
│   │   ├── tickets/
│   │   │   ├── page.tsx            # Liste tickets
│   │   │   └── [id]/page.tsx       # Détail ticket
│   │   ├── documents/
│   │   │   ├── page.tsx            # Liste documents
│   │   │   └── upload/page.tsx     # Upload
│   │   ├── inspections/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── settings/
│   │       ├── page.tsx            # Paramètres généraux
│   │       └── profile/page.tsx    # Profil
│   │
│   ├── tenant/                     # 🔑 Locataire
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Dashboard
│   │   ├── home/page.tsx           # Mon logement
│   │   ├── payments/
│   │   │   └── page.tsx            # Paiements
│   │   ├── tickets/
│   │   │   ├── page.tsx            # Mes demandes
│   │   │   └── new/page.tsx        # Nouvelle demande
│   │   ├── documents/page.tsx      # Mes documents
│   │   ├── signatures/page.tsx     # Signatures en attente
│   │   ├── meters/page.tsx         # Relevés compteurs
│   │   ├── colocation/page.tsx     # Colocation
│   │   └── settings/page.tsx       # Paramètres
│   │
│   ├── provider/                   # 🔧 Prestataire
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── jobs/page.tsx           # Interventions
│   │   └── settings/page.tsx
│   │
│   └── admin/                      # 👑 Admin (conserver existant)
│       └── ...
│
├── api/                            # Routes API (conserver)
│   └── ...
│
├── layout.tsx                      # Root layout
├── globals.css
├── not-found.tsx
└── error.tsx
```

---

## 🎨 Nouvelle Charte Graphique

### Nom de l'Application

**Décision :** `Talok` (ou garder un nom unique à valider)

### Tokens de Design

```css
/* globals.css - Tokens CSS standardisés */

:root {
  /* ===== BRAND ===== */
  --brand-primary: 217 91% 60%;        /* Bleu principal */
  --brand-primary-dark: 217 91% 50%;
  --brand-primary-light: 217 91% 70%;
  
  --brand-secondary: 264 67% 58%;      /* Violet accent */
  --brand-secondary-dark: 264 67% 48%;
  
  /* ===== SEMANTIC COLORS ===== */
  --success: 142 71% 45%;
  --success-bg: 142 71% 95%;
  --success-border: 142 71% 80%;
  
  --warning: 38 92% 50%;
  --warning-bg: 38 92% 95%;
  --warning-border: 38 92% 80%;
  
  --error: 0 84% 60%;
  --error-bg: 0 84% 95%;
  --error-border: 0 84% 80%;
  
  --info: 199 89% 48%;
  --info-bg: 199 89% 95%;
  --info-border: 199 89% 80%;
  
  /* ===== NEUTRALS ===== */
  --neutral-50: 210 40% 98%;
  --neutral-100: 210 40% 96%;
  --neutral-200: 214 32% 91%;
  --neutral-300: 213 27% 84%;
  --neutral-400: 215 20% 65%;
  --neutral-500: 215 16% 47%;
  --neutral-600: 215 19% 35%;
  --neutral-700: 215 25% 27%;
  --neutral-800: 217 33% 17%;
  --neutral-900: 222 47% 11%;
  
  /* ===== TYPOGRAPHY ===== */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-display: 'Cal Sans', 'Inter', system-ui, sans-serif;
  
  /* ===== SPACING ===== */
  --space-xs: 0.25rem;   /* 4px */
  --space-sm: 0.5rem;    /* 8px */
  --space-md: 1rem;      /* 16px */
  --space-lg: 1.5rem;    /* 24px */
  --space-xl: 2rem;      /* 32px */
  --space-2xl: 3rem;     /* 48px */
  
  /* ===== RADIUS ===== */
  --radius-sm: 0.375rem;  /* 6px */
  --radius-md: 0.5rem;    /* 8px */
  --radius-lg: 0.75rem;   /* 12px */
  --radius-xl: 1rem;      /* 16px */
  --radius-full: 9999px;
  
  /* ===== SHADOWS ===== */
  --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
}
```

### Classes Utilitaires Standardisées

```typescript
// lib/design-system/tokens.ts

export const statusStyles = {
  success: 'text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800',
  warning: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800',
  error: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',
  info: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800',
  neutral: 'text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700',
} as const;

export const kpiCardStyles = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
} as const;
```

---

## 🧩 Composants Dashboard Standardisés

### Structure des Composants

```
components/
├── dashboard/                       # Composants Dashboard partagés
│   ├── DashboardHeader.tsx         # Header avec titre et actions
│   ├── KpiCard.tsx                 # Carte KPI réutilisable
│   ├── KpiGrid.tsx                 # Grille de KPIs
│   ├── AlertsBanner.tsx            # Bannière d'alertes
│   ├── QuickActions.tsx            # Actions rapides
│   ├── RecentActivity.tsx          # Activités récentes
│   ├── EmptyState.tsx              # État vide
│   └── index.ts                    # Exports
│
├── layout/
│   ├── AppLayout.tsx               # Layout principal
│   ├── Sidebar.tsx                 # Sidebar unifiée
│   ├── Header.tsx                  # Header unifié
│   ├── MobileNav.tsx               # Navigation mobile
│   └── index.ts
│
├── shared/                         # Composants partagés
│   ├── PageHeader.tsx
│   ├── PageContainer.tsx
│   ├── DataTable.tsx
│   ├── SearchBar.tsx
│   ├── FilterBar.tsx
│   └── index.ts
│
└── ui/                             # shadcn/ui (existant)
    └── ...
```

### Exemple : KpiCard Standardisé

```tsx
// components/dashboard/KpiCard.tsx
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { kpiCardStyles } from '@/lib/design-system/tokens';

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  variant?: keyof typeof kpiCardStyles;
  trend?: {
    value: number;
    label: string;
  };
  href?: string;
}

export function KpiCard({ 
  title, 
  value, 
  icon: Icon, 
  variant = 'blue',
  trend,
  href 
}: KpiCardProps) {
  const Wrapper = href ? 'a' : 'div';
  
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              {title}
            </p>
            <p className="text-2xl font-bold tracking-tight">
              {value}
            </p>
            {trend && (
              <p className={cn(
                "text-xs",
                trend.value >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
              </p>
            )}
          </div>
          <div className={cn("p-3 rounded-xl", kpiCardStyles[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Exemple : Dashboard Owner Simplifié

```tsx
// app/(dashboard)/owner/page.tsx
import { Suspense } from 'react';
import { Building2, FileText, Euro, Wrench } from 'lucide-react';
import { 
  DashboardHeader, 
  KpiCard, 
  KpiGrid, 
  AlertsBanner,
  QuickActions,
  RecentActivity 
} from '@/components/dashboard';
import { fetchOwnerDashboard } from '@/features/owner/api';
import { FinancialSummary } from '@/features/owner/components/FinancialSummary';
import { Skeleton } from '@/components/ui/skeleton';

async function DashboardContent() {
  const data = await fetchOwnerDashboard();
  
  return (
    <div className="space-y-6">
      <DashboardHeader 
        title="Tableau de bord" 
        subtitle="Vue d'ensemble de votre patrimoine locatif"
        action={{
          label: "Ajouter un bien",
          href: "/owner/properties/new",
          icon: Building2
        }}
      />
      
      {data.alerts.length > 0 && (
        <AlertsBanner alerts={data.alerts} />
      )}
      
      <KpiGrid>
        <KpiCard 
          title="Logements" 
          value={data.properties.count} 
          icon={Building2}
          variant="blue"
          href="/owner/properties"
        />
        <KpiCard 
          title="Baux actifs" 
          value={data.leases.active} 
          icon={FileText}
          variant="green"
          href="/owner/leases"
        />
        <KpiCard 
          title="À encaisser" 
          value={`${data.finances.pending.toLocaleString('fr-FR')} €`}
          icon={Euro}
          variant="amber"
          href="/owner/finances"
        />
        <KpiCard 
          title="Tickets ouverts" 
          value={data.tickets.open} 
          icon={Wrench}
          variant="red"
          href="/owner/tickets"
        />
      </KpiGrid>
      
      <div className="grid lg:grid-cols-2 gap-6">
        <FinancialSummary data={data.finances} />
        <RecentActivity items={data.recentActivity} />
      </div>
      
      <QuickActions role="owner" />
    </div>
  );
}

export default function OwnerDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
```

---

## 🔄 Redirections à Mettre en Place

```typescript
// middleware.ts

const redirects: Record<string, string> = {
  // Anciennes routes owner vers nouvelles
  '/owner/dashboard': '/owner',
  '/owner/dashboard': '/owner',
  '/app/owner/dashboard': '/owner',
  '/owner/billing': '/owner/finances',
  '/owner/money': '/owner/finances',
  '/app/owner/money': '/owner/finances',
  '/owner/properties': '/owner/properties',
  '/owner/properties': '/owner/properties',
  '/app/owner/properties': '/owner/properties',
  '/owner/leases': '/owner/leases',
  '/app/owner/leases': '/owner/leases',
  '/owner/charges': '/owner/finances/charges',
  
  // Anciennes routes tenant vers nouvelles
  '/tenant/dashboard': '/tenant',
  '/tenant/dashboard': '/tenant',
  '/app/tenant/dashboard': '/tenant',
  '/tenant/payments': '/tenant/payments',
  '/tenant/invoices': '/tenant/payments',
  '/tenant/requests': '/tenant/tickets',
  
  // Routes génériques vers contextuelles
  '/properties': '/owner/properties',
  '/leases': '/owner/leases',
  '/tickets': '/owner/tickets',
  '/invoices': '/owner/finances/invoices',
  '/documents': '/owner/documents',
  '/charges': '/owner/finances/charges',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Vérifier les redirections
  if (pathname in redirects) {
    return NextResponse.redirect(
      new URL(redirects[pathname], request.url)
    );
  }
  
  // ... reste du middleware
}
```

---

## 📅 Planning de Migration

### Semaine 1 : Préparation et Structure

| Jour | Tâche |
|------|-------|
| J1 | Créer branche, setup nouvelle structure dossiers |
| J2 | Créer nouveaux layouts (dashboard, owner, tenant) |
| J3 | Créer composants dashboard partagés |
| J4 | Standardiser tokens CSS et design system |
| J5 | Tests et ajustements |

### Semaine 2 : Migration Pages

| Jour | Tâche |
|------|-------|
| J6 | Migrer dashboard + properties owner |
| J7 | Migrer leases + finances owner |
| J8 | Migrer dashboard + pages tenant |
| J9 | Migrer pages provider |
| J10 | Setup redirections middleware |

### Semaine 3 : Nettoyage et Tests

| Jour | Tâche |
|------|-------|
| J11 | Supprimer code mort |
| J12 | Tests E2E complets |
| J13 | Fix bugs et ajustements |
| J14 | Documentation |
| J15 | Déploiement staging + review |

---

## ✅ Checklist de Validation

### Avant Déploiement

- [ ] Toutes les routes fonctionnent
- [ ] Aucun lien cassé (tester avec crawler)
- [ ] Redirections configurées et testées
- [ ] Dark mode fonctionne partout
- [ ] Mobile responsive vérifié
- [ ] Accessibilité (WCAG 2.1 AA)
- [ ] Performance (LCP < 2.5s)
- [ ] Tests E2E passent
- [ ] Code mort supprimé
- [ ] Bundle size réduit

### Post-Déploiement

- [ ] Monitoring erreurs 404
- [ ] Analytics redirections
- [ ] Feedback utilisateurs
- [ ] Performance monitoring

---

## 🎯 Métriques de Succès

| Métrique | Cible |
|----------|-------|
| Réduction fichiers /app | > 50% |
| Bundle size JS | < 800KB |
| LCP | < 2.5s |
| FID | < 100ms |
| CLS | < 0.1 |
| Score Lighthouse Performance | > 80 |
| Score accessibilité | > 90 |
| Couverture tests | > 70% |

---

*Plan créé le 27 novembre 2025*

