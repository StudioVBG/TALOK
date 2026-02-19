/**
 * Design System Tokens - SOTA 2025
 * Système de design unifié pour Talok
 */

// ============================================================================
// STATUS COLORS
// ============================================================================

export const statusStyles = {
  success: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-900',
  warning: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-900',
  error: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/50 dark:border-rose-900',
  info: 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-400 dark:bg-sky-950/50 dark:border-sky-900',
  neutral: 'text-slate-700 bg-slate-50 border-slate-200 dark:text-slate-300 dark:bg-slate-900 dark:border-slate-800',
} as const;

export type StatusVariant = keyof typeof statusStyles;

// ============================================================================
// KPI CARD STYLES
// ============================================================================

export const kpiStyles = {
  blue: {
    icon: 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    trend: 'text-blue-600 dark:text-blue-400',
  },
  emerald: {
    icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    trend: 'text-emerald-600 dark:text-emerald-400',
  },
  amber: {
    icon: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    trend: 'text-amber-600 dark:text-amber-400',
  },
  rose: {
    icon: 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400',
    trend: 'text-rose-600 dark:text-rose-400',
  },
  violet: {
    icon: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
    trend: 'text-violet-600 dark:text-violet-400',
  },
  cyan: {
    icon: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400',
    trend: 'text-cyan-600 dark:text-cyan-400',
  },
} as const;

export type KpiVariant = keyof typeof kpiStyles;

// ============================================================================
// BADGE STYLES
// ============================================================================

export const badgeStyles = {
  default: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  warning: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  error: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-900',
  info: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-900',
  outline: 'bg-transparent border-border text-foreground',
} as const;

export type BadgeVariant = keyof typeof badgeStyles;

// ============================================================================
// PRIORITY STYLES
// ============================================================================

export const priorityStyles = {
  low: 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800',
  medium: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/50',
  high: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/50',
  urgent: 'text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/50',
} as const;

export type PriorityVariant = keyof typeof priorityStyles;

// ============================================================================
// INVOICE/PAYMENT STATUS
// ============================================================================

export const invoiceStatusStyles: Record<string, string> = {
  draft: 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700',
  sent: 'text-sky-600 bg-sky-100 border-sky-200 dark:text-sky-400 dark:bg-sky-900/50 dark:border-sky-800',
  viewed: 'text-violet-600 bg-violet-100 border-violet-200 dark:text-violet-400 dark:bg-violet-900/50 dark:border-violet-800',
  partial: 'text-amber-600 bg-amber-100 border-amber-200 dark:text-amber-400 dark:bg-amber-900/50 dark:border-amber-800',
  paid: 'text-emerald-600 bg-emerald-100 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/50 dark:border-emerald-800',
  late: 'text-rose-600 bg-rose-100 border-rose-200 dark:text-rose-400 dark:bg-rose-900/50 dark:border-rose-800',
  cancelled: 'text-slate-500 bg-slate-50 border-slate-200 dark:text-slate-500 dark:bg-slate-900 dark:border-slate-800',
};

/** @deprecated Importer InvoiceStatus depuis @/lib/types/status */
export type InvoiceStatus = string;

// ============================================================================
// LEASE STATUS
// ============================================================================

export const leaseStatusStyles: Record<string, string> = {
  draft: 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800',
  pending_signature: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/50',
  partially_signed: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/50',
  fully_signed: 'text-sky-600 bg-sky-100 dark:text-sky-400 dark:bg-sky-900/50',
  active: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/50',
  notice_given: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/50',
  terminated: 'text-slate-500 bg-slate-100 dark:text-slate-500 dark:bg-slate-800',
  archived: 'text-slate-400 bg-slate-50 dark:text-slate-500 dark:bg-slate-900',
};

/** @deprecated Importer LeaseStatus depuis @/lib/types/status */
export type LeaseStatus = string;

// ============================================================================
// TICKET STATUS
// ============================================================================

export const ticketStatusStyles = {
  open: 'text-sky-600 bg-sky-100 dark:text-sky-400 dark:bg-sky-900/50',
  in_progress: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/50',
  resolved: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/50',
  closed: 'text-slate-500 bg-slate-100 dark:text-slate-500 dark:bg-slate-800',
} as const;

export type TicketStatus = keyof typeof ticketStatusStyles;

// ============================================================================
// ANIMATIONS (CSS-only for performance)
// ============================================================================

export const animations = {
  fadeIn: 'animate-in fade-in duration-300',
  fadeOut: 'animate-out fade-out duration-200',
  slideInFromRight: 'animate-in slide-in-from-right duration-300',
  slideInFromLeft: 'animate-in slide-in-from-left duration-300',
  slideInFromTop: 'animate-in slide-in-from-top duration-300',
  slideInFromBottom: 'animate-in slide-in-from-bottom duration-300',
  scaleIn: 'animate-in zoom-in-95 duration-200',
  scaleOut: 'animate-out zoom-out-95 duration-150',
} as const;

// ============================================================================
// SPACING SYSTEM - Responsive 2025-2026
// Adapté pour: iPhone SE → iPhone 17 Pro Max → iPad → Desktop 4K
// ============================================================================

export const spacing = {
  // Page padding adaptatif (mobile → tablet → desktop)
  page: 'px-3 xs:px-4 sm:px-5 md:px-6 lg:px-8',
  
  // Section spacing vertical
  section: 'space-y-4 sm:space-y-6 lg:space-y-8',
  
  // Card padding interne
  card: 'p-3 xs:p-4 sm:p-5 lg:p-6',
  cardCompact: 'p-2.5 xs:p-3 sm:p-4',
  
  // Stack vertical (espacement entre éléments empilés)
  stack: {
    xs: 'space-y-1',
    sm: 'space-y-1.5 xs:space-y-2',
    md: 'space-y-2.5 xs:space-y-3 sm:space-y-4',
    lg: 'space-y-4 sm:space-y-5 lg:space-y-6',
    xl: 'space-y-5 sm:space-y-6 lg:space-y-8',
  },
  
  // Stack horizontal (espacement inline)
  inline: {
    xs: 'space-x-1',
    sm: 'space-x-1.5 xs:space-x-2',
    md: 'space-x-2.5 xs:space-x-3 sm:space-x-4',
    lg: 'space-x-4 sm:space-x-5 lg:space-x-6',
  },
  
  // Gap pour grids/flex
  gap: {
    xs: 'gap-1 xs:gap-1.5',
    sm: 'gap-2 xs:gap-2.5 sm:gap-3',
    md: 'gap-3 xs:gap-3.5 sm:gap-4',
    lg: 'gap-4 sm:gap-5 lg:gap-6',
  },
} as const;

// ============================================================================
// GRID SYSTEMS - Responsive 2025-2026
// Mobile-first: tous appareils du iPhone SE au Desktop 4K
// ============================================================================

export const grids = {
  // KPIs: 1 col (petit mobile) → 2 col (mobile+) → 4 col (desktop)
  kpi: 'grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-2.5 xs:gap-3 sm:gap-4',
  
  // 2 colonnes: 1 col (mobile) → 2 col (tablet+)
  twoCol: 'grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 lg:gap-6',
  
  // 3 colonnes: 1 col (mobile) → 2 col (tablet) → 3 col (desktop)
  threeCol: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6',
  
  // 4 colonnes: 2 col (mobile) → 4 col (tablet+)
  fourCol: 'grid grid-cols-2 md:grid-cols-4 gap-2 xs:gap-2.5 sm:gap-3 lg:gap-4',
  
  // Sidebar: Stack (mobile/tablet) → Sidebar à droite (desktop)
  sidebar: 'grid grid-cols-1 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_320px] gap-4 sm:gap-5 lg:gap-6',
  
  // Dashboard layout principal
  dashboard: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6',
  
  // Quick links / Actions rapides
  quickLinks: 'grid grid-cols-2 sm:grid-cols-4 gap-2 xs:gap-2.5 sm:gap-3',
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
  h1: 'text-3xl font-bold tracking-tight',
  h2: 'text-2xl font-semibold tracking-tight',
  h3: 'text-xl font-semibold',
  h4: 'text-lg font-medium',
  body: 'text-base text-foreground',
  small: 'text-sm text-muted-foreground',
  tiny: 'text-xs text-muted-foreground',
  label: 'text-sm font-medium',
} as const;

// ============================================================================
// CARD VARIANTS
// ============================================================================

export const cardStyles = {
  default: 'bg-card border border-border rounded-xl shadow-sm',
  elevated: 'bg-card border border-border rounded-xl shadow-md',
  interactive: 'bg-card border border-border rounded-xl shadow-sm hover:shadow-md hover:border-primary/20 transition-all cursor-pointer',
  ghost: 'bg-transparent border-0 shadow-none',
  gradient: 'bg-gradient-to-br from-primary/5 via-transparent to-primary/5 border border-primary/10 rounded-xl',
} as const;

export type CardVariant = keyof typeof cardStyles;

// ============================================================================
// BUTTON VARIANTS (extended)
// ============================================================================

export const buttonExtended = {
  gradient: 'bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg shadow-primary/25',
  glow: 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-shadow',
} as const;

// ============================================================================
// NAVIGATION STYLES
// ============================================================================

export const navStyles = {
  item: 'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
  itemActive: 'bg-primary/10 text-primary dark:bg-primary/20',
  itemInactive: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  icon: 'h-5 w-5 shrink-0',
  iconActive: 'text-primary',
  iconInactive: 'text-muted-foreground',
} as const;

// ============================================================================
// APP CONFIG
// ============================================================================

export const APP_CONFIG = {
  name: 'Talok',
  shortName: 'Talok',
  tagline: 'La plateforme tout-en-un pour gérer vos locations',
  description: 'Baux automatiques, signatures électroniques, scoring locataires, paiements et quittances.',
  logo: {
    icon: 'Building2',
    gradient: 'from-blue-600 to-indigo-600',
  },
  support: {
    email: 'support@talok.fr',
  },
} as const;

// Export simple du nom pour faciliter l'import
export const APP_NAME = APP_CONFIG.name;

// ============================================================================
// ROLE SPECIFIC COLORS
// ============================================================================

export const roleStyles = {
  owner: {
    primary: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/50',
    border: 'border-blue-200 dark:border-blue-900',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  },
  tenant: {
    primary: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/50',
    border: 'border-emerald-200 dark:border-emerald-900',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  },
  provider: {
    primary: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-50 dark:bg-violet-950/50',
    border: 'border-violet-200 dark:border-violet-900',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300',
  },
  admin: {
    primary: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/50',
    border: 'border-rose-200 dark:border-rose-900',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
  },
  agency: {
    primary: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-50 dark:bg-indigo-950/50',
    border: 'border-indigo-200 dark:border-indigo-900',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  },
  guarantor: {
    primary: 'text-teal-600 dark:text-teal-400',
    bg: 'bg-teal-50 dark:bg-teal-950/50',
    border: 'border-teal-200 dark:border-teal-900',
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
  },
  syndic: {
    primary: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-50 dark:bg-cyan-950/50',
    border: 'border-cyan-200 dark:border-cyan-900',
    badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  },
  copro: {
    primary: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-50 dark:bg-sky-950/50',
    border: 'border-sky-200 dark:border-sky-900',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300',
  },
} as const;

export type UserRole = keyof typeof roleStyles;
