# Analyse @react-pdf/renderer pour Talok

## Contexte du Projet

### Stack PDF Actuelle
| Composant | Technologie | Rôle |
|-----------|-------------|------|
| Client-side | `html2pdf.js` (v0.12.1) | Conversion HTML → PDF dans le navigateur |
| Manipulation | `pdf-lib` (v1.17.1) | Manipulation programmatique de PDF |
| Images | `sharp` (v0.34.5) | Traitement d'images côté serveur |
| Fallback | Print dialog natif | Si html2pdf échoue |

### Template EDL Existant
- **Taille** : 1346 lignes (936 lignes template principal + 410 lignes template vierge)
- **Syntaxe** : HTML avec Handlebars-style templating (`{{#if}}`, `{{#unless}}`)
- **CSS** : Inline styles avec support @media print
- **Variables** : 70+ variables dynamiques

---

## Analyse Technique Détaillée

### 1. Utilisation de CSS Grid (Problème Majeur)

Le template actuel utilise **CSS Grid** à 5 endroits critiques :

```css
/* Utilisations de display: grid dans edl.template.ts */

/* Ligne 111-115 */
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

/* Ligne 155-158 */
.meter-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

/* Ligne 318-322 */
.photos-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

/* Ligne 455-458 */
.signatures-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

/* Ligne 1089-1092 (template vierge) */
.signatures {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
```

**Impact @react-pdf/renderer** : Grid n'est PAS supporté. Il faudrait réécrire toutes ces sections avec des `<View>` imbriqués et `flexDirection: 'row'`.

---

### 2. Fonctionnalités CSS Avancées Utilisées

| Fonctionnalité | Lignes | Support @react-pdf |
|----------------|--------|-------------------|
| `linear-gradient()` | 100 | Non supporté |
| `border-left` avec épaisseur | 101, 308 | Partiellement |
| `aspect-ratio` | 325 | Non supporté |
| `object-fit: cover` | 333 | Non supporté (images) |
| `box-shadow` implicite | Multiple | Non supporté |
| `text-transform: uppercase` | Multiple | Non supporté |
| Pseudo-classes (`:last-child`, `:nth-child`) | 259-266 | Non supporté |

---

### 3. Gestion des Images

**Situation actuelle** :
- Images stockées dans Supabase Storage (bucket privé)
- URLs signées générées à la volée (expiration 1 heure)
- Pattern : `await supabase.storage.from('documents').createSignedUrl(path, 3600)`

**Avec @react-pdf/renderer** :
- Les images doivent être en **base64** ou **URL absolue accessible**
- Les URLs signées Supabase fonctionneraient, mais avec latence réseau accrue
- Alternative : pré-convertir en base64 (augmente la taille du payload)

**Code actuel** (`app/api/edl/pdf/route.ts`) :
```typescript
// Les URLs signées sont déjà gérées
const signedUrlResult = await supabaseAdmin.storage
  .from('documents')
  .createSignedUrl(media.file_path, 3600);
```

---

### 4. Templating Dynamique

Le template utilise une syntaxe Handlebars-like :

```html
{{#if SIGNATURE_IMAGE_BAILLEUR}}
  <img src="{{SIGNATURE_IMAGE_BAILLEUR}}" alt="Signature" />
{{/if}}

{{#unless DATE_SIGNATURE_BAILLEUR}}
  <span class="placeholder">Signature en attente</span>
{{/unless}}

{{#if IS_EDL_SORTIE}}
  <p>En cas de sortie : comparaison avec l'EDL d'entrée...</p>
{{/if}}
```

**Avec @react-pdf/renderer** : Ce serait du JSX natif, donc plus simple :
```tsx
{signatureImageBailleur && <Image src={signatureImageBailleur} />}
{!dateSignatureBailleur && <Text>Signature en attente</Text>}
```

---

## Estimation de l'Effort de Migration

### Composants à Réécrire

| Composant | Complexité | Effort Estimé |
|-----------|------------|---------------|
| Header avec logo/référence | Faible | 0.5 jour |
| Section parties (bailleur/locataire) | Moyenne | 0.5 jour |
| Section logement | Faible | 0.25 jour |
| Section compteurs (4 cards en grid) | Moyenne | 0.5 jour |
| Détail des pièces (tableaux dynamiques) | Haute | 1.5 jours |
| Grille de photos (4 colonnes) | Haute | 1 jour |
| Section signatures | Moyenne | 0.5 jour |
| Certificat de signature | Moyenne | 0.5 jour |
| Footer légal | Faible | 0.25 jour |
| **Template vierge** | Haute | 1 jour |
| **Tests & ajustements** | - | 1-2 jours |

**Total estimé** : **7-9 jours de développement**

---

## Comparaison : Garder html2pdf.js vs Migrer

### Option A : Garder l'Architecture Actuelle (Recommandé)

| Aspect | État |
|--------|------|
| Template existant | 1346 lignes, testé en production |
| Maintenance | Faible - HTML/CSS standard |
| Performance | Correcte pour l'usage actuel |
| Coût | Gratuit (html2pdf.js est MIT) |
| Risque | Faible - système éprouvé |

**Améliorations possibles sans migration** :
1. Optimiser les images avant insertion (Sharp + compression)
2. Ajouter un cache pour les templates HTML compilés
3. Implémenter une génération server-side avec Puppeteer (si hébergement le permet)

### Option B : Migrer vers @react-pdf/renderer

| Aspect | État |
|--------|------|
| Effort initial | 7-9 jours |
| Syntaxe | JSX (cohérent avec le reste du projet) |
| Performance | Potentiellement meilleure (pas de DOM) |
| Flexibilité | Limitée (pas de Grid, CSS limité) |
| Risque | Moyen - apprentissage + bugs possibles |

---

## Verdict Final pour Talok

### Ne PAS migrer vers @react-pdf/renderer

**Raisons principales** :

1. **Template existant robuste** : 1346 lignes de HTML/CSS testé en production
2. **CSS Grid omniprésent** : 5 utilisations critiques qui nécessiteraient une réécriture complète
3. **Fonctionnalités CSS avancées** : gradients, aspect-ratio, pseudo-sélecteurs
4. **ROI négatif** : 7-9 jours de dev pour un résultat équivalent (voire inférieur)
5. **Risque de régression** : Mise en page pixel-perfect à recréer from scratch

### Quand @react-pdf/renderer serait pertinent

- Nouveau projet sans template existant
- Template simple (texte + images basiques, pas de grids)
- Besoin de génération 100% server-side sur Netlify/Vercel
- Équipe très à l'aise avec les limitations CSS de la lib

### Recommandations pour Talok

1. **Conserver html2pdf.js** pour l'EDL
2. **Optimiser le système actuel** :
   - Compression des images avant insertion
   - Lazy loading du module html2pdf.js (déjà fait)
   - Cache des templates HTML générés
3. **Si besoin server-side** : Envisager une fonction Supabase Edge avec Deno + Puppeteer-core

---

## Annexe : Architecture PDF Actuelle

```
┌─────────────────────────────────────────────────────────────┐
│                    Flux de Génération PDF                    │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  EDL Data    │───▶│  Template Service │───▶│   HTML String    │
│  (DB fetch)  │    │  (variable subst) │    │  (1346 lines)    │
└──────────────┘    └──────────────────┘    └────────┬─────────┘
                                                      │
                                                      ▼
                    ┌─────────────────────────────────────────┐
                    │           Client-side Options            │
                    └─────────────────────────────────────────┘
                              │                    │
                              ▼                    ▼
                    ┌──────────────┐    ┌──────────────────────┐
                    │  html2pdf.js │    │   Print Dialog       │
                    │  (primary)   │    │   (fallback)         │
                    └──────────────┘    └──────────────────────┘
                              │                    │
                              ▼                    ▼
                    ┌──────────────────────────────────────────┐
                    │              PDF Download                 │
                    └──────────────────────────────────────────┘
```

---

**Document généré le** : 2026-01-27
**Contexte** : Analyse de migration PDF pour Talok (gestion locative)
