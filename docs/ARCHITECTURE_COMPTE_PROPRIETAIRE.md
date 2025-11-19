# Architecture du Compte Propriétaire

## 📁 Structure des fichiers

```
app/app/owner/
├── layout.tsx                    # Layout global (OwnerAppLayout)
├── dashboard/
│   ├── page.tsx                 # Server Component
│   └── OwnerDashboardClient.tsx # Client Component
├── properties/
│   ├── page.tsx                 # Server Component
│   ├── OwnerPropertiesClient.tsx # Client Component
│   └── [id]/
│       └── page.tsx            # Détail d'un bien
├── contracts/
│   ├── page.tsx                 # Server Component
│   ├── OwnerContractsClient.tsx # Client Component
│   └── [id]/
│       └── page.tsx            # Détail d'un bail
├── money/
│   ├── page.tsx                 # Server Component
│   └── OwnerMoneyClient.tsx    # Client Component
├── documents/
│   ├── page.tsx                 # Server Component
│   └── OwnerDocumentsClient.tsx # Client Component
└── support/
    └── page.tsx                 # Page Support

lib/owner/
├── types.ts                     # Types TypeScript centralisés
├── api.ts                       # Fonctions de fetch vers les API
├── constants.ts                 # Constantes (modules, statuts, labels)
└── index.ts                     # Export centralisé

components/owner/
├── cards/
│   ├── OwnerPropertyCard.tsx   # Carte de propriété réutilisable
│   ├── OwnerKpiCard.tsx        # Carte KPI réutilisable
│   └── OwnerSectionCard.tsx    # Wrapper générique
├── dashboard/
│   ├── owner-todo-section.tsx  # Section TODO
│   ├── owner-finance-summary.tsx # Section finances
│   ├── owner-portfolio-by-module.tsx # Portefeuille par module
│   └── owner-risk-section.tsx  # Section risques
└── index.ts                     # Export centralisé
```

## 🔄 Pattern Server Component + Client Component

### Server Component (`page.tsx`)
- Charge les données initiales côté serveur
- Gère l'authentification et les redirections
- Passe les données au Client Component

```tsx
export default async function OwnerPropertiesPage({ searchParams }) {
  // Authentification
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Récupération du profil
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  // Chargement des données
  const properties = await fetchOwnerProperties(profile.id, {
    module: searchParams.module,
    type: searchParams.type,
    status: searchParams.status,
    search: searchParams.search,
  });

  // Passage au Client Component
  return <OwnerPropertiesClient initialProperties={properties} />;
}
```

### Client Component (`*Client.tsx`)
- Gère les interactions (filtres, recherche, onglets)
- Utilise React Query pour le cache et le refetch automatique
- Utilise les données initiales comme fallback

```tsx
"use client";

export function OwnerPropertiesClient({ initialProperties }) {
  // React Query pour le cache et le refetch
  const { data: properties = initialProperties, isLoading, error } = useProperties();

  // Interactions (filtres, recherche)
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Rendu avec gestion des états
  if (isLoading) return <Skeleton />;
  if (error) return <ErrorState />;
  if (properties.length === 0) return <EmptyState />;

  return <PropertiesGrid properties={properties} />;
}
```

## 🎯 Services centralisés (`lib/owner/api.ts`)

Toutes les fonctions de fetch sont centralisées :

```tsx
// Récupération des propriétés
export async function fetchOwnerProperties(
  ownerId: string,
  filters?: FetchOwnerPropertiesFilters
): Promise<OwnerProperty[]>

// Récupération du dashboard
export async function fetchOwnerDashboard(
  ownerId: string
): Promise<OwnerDashboardData>

// Récupération des baux
export async function fetchOwnerContracts(
  ownerId: string,
  filters?: { property_id?: string; status?: LeaseStatus; search?: string }
): Promise<OwnerContract[]>

// Récupération des factures
export async function fetchOwnerMoneyInvoices(
  ownerId: string,
  filters?: { module?: OwnerModuleKey; status?: InvoiceStatus; search?: string }
): Promise<OwnerMoneyInvoice[]>

// Récupération des documents
export async function fetchOwnerDocuments(
  ownerId: string,
  filters?: { type?: string; status?: DocumentStatus; property_id?: string; lease_id?: string; search?: string }
): Promise<OwnerDocument[]>
```

## 📦 Types centralisés (`lib/owner/types.ts`)

Tous les types sont définis dans un seul fichier :

- `OwnerProperty` - Propriété avec statut et loyer mensuel
- `OwnerContract` - Bail avec propriété et locataire
- `OwnerMoneyInvoice` - Facture avec propriété et locataire
- `OwnerDocument` - Document avec propriété et bail
- `OwnerDashboardData` - Données complètes du dashboard
- `OwnerTodoItem` - Tâche à faire
- `OwnerRiskItem` - Risque de conformité
- `OwnerModuleStats` - Statistiques par module

## 🧩 Composants réutilisables

### `OwnerPropertyCard`
Carte de propriété avec :
- Image de couverture
- Statut (Loué/Vacant/En préavis)
- Type de bien
- Adresse
- Loyer mensuel
- Bouton "Voir la fiche"

### `OwnerKpiCard`
Carte KPI avec :
- Label
- Valeur formatée
- Différence vs période précédente
- Pourcentage du montant attendu
- Gradient personnalisable

### `OwnerSectionCard`
Wrapper générique pour les sections avec :
- Titre et description
- Action dans le header (optionnel)
- Contenu personnalisable

## 🔐 Sécurité

- Toutes les pages vérifient l'authentification côté serveur
- Redirection automatique si non authentifié ou mauvais rôle
- Filtrage des données par `owner_id` côté serveur
- RLS (Row Level Security) activé sur Supabase

## ⚡ Performance

- **SSR** : Données chargées côté serveur pour un premier rendu rapide
- **Cache React Query** : Données mises en cache pour éviter les refetch inutiles
- **Lazy Loading** : Composants lourds chargés dynamiquement
- **Debounce** : Recherche avec debounce pour éviter trop de requêtes

## 🧪 Tests recommandés

1. **Navigation** : Vérifier que toutes les pages se chargent
2. **Données** : Vérifier que les données s'affichent correctement
3. **Filtres** : Tester tous les filtres sur chaque page
4. **Recherche** : Tester la recherche avec debounce
5. **États** : Vérifier les états de chargement, erreur, vide
6. **Cache** : Vérifier que React Query met bien en cache les données
7. **Refetch** : Vérifier le refetch automatique après mutations

