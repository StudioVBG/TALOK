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

export const invoiceStatusStyles = {
  draft: 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700',
  sent: 'text-sky-600 bg-sky-100 border-sky-200 dark:text-sky-400 dark:bg-sky-900/50 dark:border-sky-800',
  paid: 'text-emerald-600 bg-emerald-100 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/50 dark:border-emerald-800',
  late: 'text-rose-600 bg-rose-100 border-rose-200 dark:text-rose-400 dark:bg-rose-900/50 dark:border-rose-800',
  cancelled: 'text-slate-500 bg-slate-50 border-slate-200 dark:text-slate-500 dark:bg-slate-900 dark:border-slate-800',
} as const;

export type InvoiceStatus = keyof typeof invoiceStatusStyles;

// ============================================================================
// LEASE STATUS
// ============================================================================

export const leaseStatusStyles = {
  draft: 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800',
  pending_signature: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/50',
  active: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/50',
  terminated: 'text-slate-500 bg-slate-100 dark:text-slate-500 dark:bg-slate-800',
} as const;

export type LeaseStatus = keyof typeof leaseStatusStyles;

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
// SPACING SYSTEM
// ============================================================================

export const spacing = {
  page: 'px-4 sm:px-6 lg:px-8',
  section: 'space-y-6',
  card: 'p-4 sm:p-6',
  stack: {
    xs: 'space-y-1',
    sm: 'space-y-2',
    md: 'space-y-4',
    lg: 'space-y-6',
    xl: 'space-y-8',
  },
  inline: {
    xs: 'space-x-1',
    sm: 'space-x-2',
    md: 'space-x-4',
    lg: 'space-x-6',
  },
} as const;

// ============================================================================
// GRID SYSTEMS
// ============================================================================

export const grids = {
  kpi: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
  twoCol: 'grid grid-cols-1 lg:grid-cols-2 gap-6',
  threeCol: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6',
  sidebar: 'grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6',
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
} as const;

export type UserRole = keyof typeof roleStyles;
