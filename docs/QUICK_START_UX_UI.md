# 🚀 Guide de démarrage rapide - UX/UI SOTA 2025

## Installation des dépendances

Toutes les dépendances nécessaires sont déjà installées :

```bash
npm install
```

Les packages suivants sont utilisés :
- `next-themes` - Gestion du dark mode
- `react-swipeable` - Gestures pour la galerie photos
- `framer-motion` - Animations fluides
- `tailwindcss-animate` - Animations Tailwind

## 🎨 Utilisation des composants

### 1. EmptyState

Afficher un état vide avec style :

```tsx
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";

<EmptyState
  icon={Building2}
  title="Aucun bien"
  description="Commencez par ajouter votre premier bien."
  action={{
    label: "Ajouter un bien",
    onClick: () => router.push("/properties/new"),
  }}
  size="lg"
/>
```

### 2. ErrorState

Afficher une erreur avec possibilité de retry :

```tsx
import { ErrorState } from "@/components/ui/error-state";

<ErrorState
  title="Erreur de chargement"
  description="Impossible de charger les données."
  onRetry={() => refetch()}
/>
```

### 3. SkeletonPropertyCard

Afficher un skeleton pendant le chargement :

```tsx
import { SkeletonPropertyCard } from "@/components/ui/skeleton-card";

{isLoading && (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <SkeletonPropertyCard key={i} />
    ))}
  </div>
)}
```

### 4. ButtonEnhanced

Utiliser un bouton avec loading et ripple :

```tsx
import { ButtonEnhanced } from "@/components/ui/button-enhanced";

<ButtonEnhanced
  isLoading={isSubmitting}
  variant="gradient"
  onClick={handleSubmit}
>
  Enregistrer
</ButtonEnhanced>
```

### 5. DarkModeToggle

Ajouter le toggle de thème dans un header :

```tsx
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle";

<header>
  <DarkModeToggle />
</header>
```

## 🎭 Utiliser les animations

### Animation d'entrée simple

```tsx
import { motion } from "framer-motion";

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Contenu animé
</motion.div>
```

### Animation avec stagger (liste)

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

<motion.div variants={containerVariants} initial="hidden" animate="visible">
  {items.map((item) => (
    <motion.div key={item.id} variants={itemVariants}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

## 🎨 Utiliser les tokens de design

```tsx
import { designTokens } from "@/lib/design-system/tokens";

// Couleurs
const primaryColor = designTokens.colors.primary[600];
const successColor = designTokens.colors.semantic.success.DEFAULT;

// Espacements
const padding = designTokens.spacing.lg; // 1.5rem

// Ombres
const shadow = designTokens.shadows.lg;

// Transitions
const transition = designTokens.transitions.base;
```

## 🌙 Dark Mode

Le dark mode est automatiquement configuré via `ThemeProvider` dans `app/layout.tsx`.

Pour utiliser le thème dans un composant :

```tsx
"use client";
import { useTheme } from "next-themes";

export function MyComponent() {
  const { theme, setTheme } = useTheme();
  
  return (
    <div>
      <p>Thème actuel : {theme}</p>
      <button onClick={() => setTheme("dark")}>Mode sombre</button>
    </div>
  );
}
```

## 📱 Galerie photos améliorée

Utiliser la galerie avec gestures :

```tsx
import { OwnerPropertyPhotosEnhanced } from "@/components/owner/properties/OwnerPropertyPhotosEnhanced";

<OwnerPropertyPhotosEnhanced
  photos={property.photos}
  propertyId={property.id}
  onUploadClick={() => router.push(`/properties/${property.id}/photos`)}
/>
```

**Fonctionnalités** :
- Swipe gauche/droite pour naviguer
- Flèches clavier ← →
- Escape pour fermer
- Thumbnails en bas
- Transitions fluides

## 🎯 Classes CSS utiles

### Glassmorphism

```tsx
className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/20 dark:border-slate-700/50"
```

### Animations Tailwind

```tsx
className="animate-fade-in"      // Fade in
className="animate-slide-in-right" // Slide depuis la droite
className="animate-scale-in"     // Scale in
className="animate-shimmer"      // Shimmer effect
```

### Ombres harmonisées

```tsx
className="shadow-sm"  // Petite ombre
className="shadow-md"  // Ombre moyenne
className="shadow-lg"  // Grande ombre
className="shadow-xl"  // Très grande ombre
className="shadow-2xl" // Ombre maximale
```

## ✅ Checklist pour une nouvelle page

- [ ] Utiliser `PageTransition` pour les transitions
- [ ] Ajouter `EmptyState` si pas de données
- [ ] Ajouter `ErrorState` pour les erreurs
- [ ] Utiliser `SkeletonPropertyCard` pendant le chargement
- [ ] Appliquer glassmorphism sur les Cards
- [ ] Ajouter des animations d'entrée
- [ ] Vérifier le dark mode
- [ ] Tester sur mobile

## 🐛 Dépannage

### Le dark mode ne fonctionne pas

Vérifiez que `ThemeProvider` est bien dans `app/layout.tsx` :

```tsx
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

### Les animations ne s'affichent pas

Vérifiez que `framer-motion` est installé :

```bash
npm list framer-motion
```

### Les skeletons ne shimmer pas

Vérifiez que la classe `animate-shimmer` est dans `app/globals.css`.

## 📚 Ressources

- [Documentation complète](./UX_UI_SOTA_2025.md)
- [Framer Motion Docs](https://www.framer.com/motion/)
- [Tailwind CSS](https://tailwindcss.com/)
- [next-themes](https://github.com/pacocoursey/next-themes)

---

**Bon développement ! 🚀**

