"use client";

/**
 * Admin Plans Page - Version SOTA Ultra++ Novembre 2025
 * 
 * Features:
 * - Plan Cards avec Drag & Drop
 * - Quick Inline Edit (double-click)
 * - Revenue Simulator
 * - Bulk Actions
 * - Debounced inputs
 * - React.memo optimizations
 * - Dark Mode complet
 * - Command Palette
 * - Undo/Redo
 * - Export/Import JSON
 * - Email Preview
 * - Plan Distribution Chart
 * - Auto-backup LocalStorage
 * - Reduced Motion support
 * - Feature Usage Stats
 */

import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import { motion, AnimatePresence, Reorder, useDragControls } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { 
  Save, Euro, Users, Home, FileText, Loader2, 
  AlertTriangle, Bell, Calendar, Shield, History,
  CreditCard, Zap, Brain, Clock, Check, X,
  ChevronDown, ChevronRight, Plus, Package, Grid3X3,
  Building2, Mail, Key, Palette, Lock, Headphones,
  BarChart3, Upload, Trash2, Edit, LayoutGrid,
  Eye, Undo2, Redo2, Search, Command, Sparkles,
  Info, Settings, ExternalLink, Copy, RefreshCw,
  CheckCircle2, XCircle, TrendingUp, TrendingDown,
  GripVertical, Calculator, PieChart, ArrowUpRight,
  ArrowDownRight, Moon, Sun, Laptop, MoreHorizontal,
  CheckSquare, Square, Minus, Download, FileJson,
  Send, MailOpen, Activity, HardDrive
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface PlanFeatures {
  signatures?: boolean;
  signatures_monthly_quota?: number;
  lease_generation?: boolean;
  lease_templates?: "basic" | "full" | "custom";
  edl_digital?: boolean;
  attestations?: boolean;
  ocr_documents?: boolean;
  storage_gb?: number;
  email_templates?: boolean;
  open_banking?: boolean;
  open_banking_level?: "none" | "basic" | "advanced" | "premium";
  bank_reconciliation?: boolean;
  auto_reminders?: boolean;
  auto_reminders_sms?: boolean;
  irl_revision?: boolean;
  alerts_deadlines?: boolean;
  deposit_tracking?: boolean;
  tenant_payment_online?: boolean;
  export_csv?: boolean;
  export_excel?: boolean;
  export_accounting?: boolean;
  tenant_portal?: "none" | "basic" | "advanced" | "whitelabel";
  colocation?: boolean;
  multi_units?: boolean;
  multi_users?: boolean;
  max_users?: number;
  roles_permissions?: boolean;
  activity_log?: boolean;
  multi_mandants?: boolean;
  owner_reports?: boolean;
  work_orders?: boolean;
  work_orders_planning?: boolean;
  providers_management?: boolean;
  channel_manager?: "none" | "basic" | "full";
  api_access?: boolean;
  api_access_level?: "none" | "basic" | "full";
  webhooks?: boolean;
  white_label?: boolean;
  sso?: boolean;
  priority_support?: boolean;
  support_phone?: boolean;
  onboarding?: boolean;
  data_import?: boolean;
  custom_sla?: boolean;
  account_manager?: boolean;
  scoring_ia?: boolean;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  max_properties: number;
  max_leases: number;
  max_tenants: number;
  max_documents_gb: number;
  included_properties: number;
  extra_property_price: number;
  billing_type: "fixed" | "per_unit" | "tiered";
  features: PlanFeatures;
  is_active: boolean;
  is_popular: boolean;
  display_order: number;
  active_subscribers_count?: number;
}

interface Addon {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: Record<string, any>;
  compatible_plans: string[];
  is_active: boolean;
  display_order: number;
  active_subscriptions_count?: number;
}

// ============================================
// HOOKS
// ============================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) setStoredValue(JSON.parse(item));
    } catch (error) {
      console.error(error);
    }
  }, [key]);
  
  const setValue = (value: T) => {
    setStoredValue(value);
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(error);
    }
  };
  
  return [storedValue, setValue];
}

// Hook pour détecter reduced motion
function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);
  
  return reducedMotion;
}

// Hook pour auto-backup
function useAutoBackup(data: any, key: string) {
  const lastBackup = useRef<Date | null>(null);
  
  useEffect(() => {
    if (!data || Object.keys(data).length === 0) return;
    
    const backup = () => {
      try {
        localStorage.setItem(`${key}_backup`, JSON.stringify({
          data,
          timestamp: new Date().toISOString()
        }));
        lastBackup.current = new Date();
      } catch (e) {
        console.error("Auto-backup failed:", e);
      }
    };
    
    // Backup toutes les 30 secondes si des changements
    const interval = setInterval(backup, 30000);
    
    // Backup avant de quitter la page
    const handleBeforeUnload = () => backup();
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [data, key]);
  
  return lastBackup.current;
}

// ============================================
// CONFIGURATION
// ============================================

const PLAN_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string; ring: string }> = {
  solo: { 
    bg: "bg-slate-500/10", 
    border: "border-slate-500/30", 
    text: "text-slate-600 dark:text-slate-400",
    gradient: "from-slate-500/20 to-slate-600/5",
    ring: "ring-slate-500/50"
  },
  confort: { 
    bg: "bg-blue-500/10", 
    border: "border-blue-500/30", 
    text: "text-blue-600 dark:text-blue-400",
    gradient: "from-blue-500/20 to-blue-600/5",
    ring: "ring-blue-500/50"
  },
  pro: { 
    bg: "bg-violet-500/10", 
    border: "border-violet-500/30", 
    text: "text-violet-600 dark:text-violet-400",
    gradient: "from-violet-500/20 to-violet-600/5",
    ring: "ring-violet-500/50"
  },
  enterprise: { 
    bg: "bg-amber-500/10", 
    border: "border-amber-500/30", 
    text: "text-amber-600 dark:text-amber-400",
    gradient: "from-amber-500/20 to-amber-600/5",
    ring: "ring-amber-500/50"
  },
};

const FEATURE_GROUPS = [
  {
    id: "documents",
    label: "Documents & Signatures",
    icon: FileText,
    features: [
      { key: "signatures", label: "E-signature Yousign", type: "boolean" },
      { key: "signatures_monthly_quota", label: "Signatures/mois", type: "number", unlimited: -1 },
      { key: "lease_generation", label: "Génération auto baux", type: "boolean" },
      { key: "lease_templates", label: "Modèles de baux", type: "level", levels: ["basic", "full", "custom"] },
      { key: "edl_digital", label: "EDL numériques", type: "boolean" },
      { key: "attestations", label: "Attestations", type: "boolean" },
      { key: "ocr_documents", label: "OCR Mindee", type: "boolean" },
      { key: "storage_gb", label: "Stockage (Go)", type: "number", unlimited: -1 },
      { key: "email_templates", label: "Modèles emails", type: "boolean" },
    ]
  },
  {
    id: "finances",
    label: "Loyers & Finances",
    icon: Euro,
    features: [
      { key: "open_banking_level", label: "Open Banking", type: "level", levels: ["none", "basic", "advanced", "premium"] },
      { key: "bank_reconciliation", label: "Rapprochement bancaire", type: "boolean" },
      { key: "auto_reminders", label: "Relances email", type: "boolean" },
      { key: "auto_reminders_sms", label: "Relances SMS", type: "boolean" },
      { key: "irl_revision", label: "Révision IRL auto", type: "boolean" },
      { key: "alerts_deadlines", label: "Alertes échéances", type: "boolean" },
      { key: "deposit_tracking", label: "Suivi dépôts garantie", type: "boolean" },
      { key: "tenant_payment_online", label: "Paiement en ligne", type: "boolean" },
      { key: "export_csv", label: "Export CSV", type: "boolean" },
      { key: "export_excel", label: "Export Excel", type: "boolean" },
      { key: "export_accounting", label: "Export comptable FEC", type: "boolean" },
    ]
  },
  {
    id: "properties",
    label: "Biens & Baux",
    icon: Home,
    features: [
      { key: "tenant_portal", label: "Portail locataire", type: "level", levels: ["none", "basic", "advanced", "whitelabel"] },
      { key: "colocation", label: "Gestion colocation", type: "boolean" },
      { key: "multi_units", label: "Unités multiples", type: "boolean" },
    ]
  },
  {
    id: "collaboration",
    label: "Collaboration",
    icon: Users,
    features: [
      { key: "multi_users", label: "Multi-utilisateurs", type: "boolean" },
      { key: "max_users", label: "Utilisateurs max", type: "number", unlimited: -1 },
      { key: "roles_permissions", label: "Rôles & permissions", type: "boolean" },
      { key: "activity_log", label: "Journal d'audit", type: "boolean" },
      { key: "multi_mandants", label: "Multi-mandants", type: "boolean" },
      { key: "owner_reports", label: "Rapports propriétaires", type: "boolean" },
    ]
  },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: Building2,
    features: [
      { key: "work_orders", label: "Tickets maintenance", type: "boolean" },
      { key: "work_orders_planning", label: "Planning interventions", type: "boolean" },
      { key: "providers_management", label: "Gestion prestataires", type: "boolean" },
    ]
  },
  {
    id: "integrations",
    label: "Intégrations",
    icon: Key,
    features: [
      { key: "channel_manager", label: "Channel manager", type: "level", levels: ["none", "basic", "full"] },
      { key: "api_access_level", label: "Accès API", type: "level", levels: ["none", "basic", "full"] },
      { key: "webhooks", label: "Webhooks", type: "boolean" },
      { key: "white_label", label: "White label", type: "boolean" },
      { key: "sso", label: "SSO SAML/OAuth", type: "boolean" },
    ]
  },
  {
    id: "support",
    label: "Support",
    icon: Headphones,
    features: [
      { key: "priority_support", label: "Support prioritaire", type: "boolean" },
      { key: "support_phone", label: "Support téléphone", type: "boolean" },
      { key: "onboarding", label: "Onboarding personnalisé", type: "boolean" },
      { key: "data_import", label: "Import données", type: "boolean" },
      { key: "custom_sla", label: "SLA contractuel", type: "boolean" },
      { key: "account_manager", label: "Account manager", type: "boolean" },
    ]
  },
  {
    id: "ia",
    label: "IA & Avancé",
    icon: Brain,
    features: [
      { key: "scoring_ia", label: "Scoring IA locataire", type: "boolean" },
    ]
  },
];

const LEVEL_LABELS: Record<string, string> = {
  none: "Non",
  basic: "Basic",
  advanced: "Avancé",
  premium: "Premium",
  full: "Complet",
  whitelabel: "White label",
  custom: "Sur mesure",
};

// ============================================
// HELPERS
// ============================================

function formatEuros(cents: number): string {
  if (cents === 0) return "Gratuit";
  return new Intl.NumberFormat('fr-FR', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function centsToEuros(cents: number): number {
  return cents / 100;
}

function eurosToCents(euros: number): number {
  return Math.round(euros * 100);
}

function getPlanColor(slug: string) {
  return PLAN_COLORS[slug] || PLAN_COLORS.solo;
}

function countActiveFeatures(features: PlanFeatures): number {
  if (!features) return 0;
  return Object.values(features).filter(v => 
    v === true || 
    (typeof v === "string" && v !== "none") || 
    (typeof v === "number" && v !== 0)
  ).length;
}

// ============================================
// SKELETON
// ============================================

function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-64 rounded bg-muted/60 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-muted animate-pulse" />
          <div className="h-9 w-32 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="relative overflow-hidden rounded-xl border bg-card p-6">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-6 w-24 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-32 rounded bg-muted/60 animate-pulse" />
                </div>
                <div className="h-8 w-16 rounded bg-muted animate-pulse" />
              </div>
              <div className="h-10 w-full rounded bg-muted/40 animate-pulse" />
              <div className="flex gap-2">
                <div className="h-6 w-20 rounded bg-muted/30 animate-pulse" />
                <div className="h-6 w-24 rounded bg-muted/30 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// INLINE PRICE EDITOR
// ============================================

function InlinePriceEditor({
  value,
  onChange,
  className
}: {
  value: number;
  onChange: (cents: number) => void;
  className?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(centsToEuros(value).toString());
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    setLocalValue(centsToEuros(value).toString());
  }, [value]);
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  const handleBlur = () => {
    setIsEditing(false);
    const euros = parseFloat(localValue) || 0;
    onChange(eurosToCents(euros));
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setLocalValue(centsToEuros(value).toString());
      setIsEditing(false);
    }
  };
  
  if (isEditing) {
    return (
      <div className="relative inline-flex items-baseline">
        <Input
          ref={inputRef}
          type="number"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-20 h-8 text-2xl font-bold pr-6 text-right"
          min={0}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-lg font-bold">€</span>
      </div>
    );
  }
  
  return (
    <span
      className={cn(
        "cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors",
        className
      )}
      onDoubleClick={() => setIsEditing(true)}
      title="Double-cliquez pour modifier"
    >
      {centsToEuros(value)}€
    </span>
  );
}

// ============================================
// REVENUE SIMULATOR
// ============================================

function RevenueSimulator({
  plans,
  originalPlans,
  open,
  onOpenChange
}: {
  plans: Plan[];
  originalPlans: Plan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [churnRate, setChurnRate] = useState([5]); // 5% par défaut
  
  const simulation = useMemo(() => {
    const results: Array<{
      plan: Plan;
      original: Plan;
      subscribers: number;
      oldMRR: number;
      newMRR: number;
      mrrDelta: number;
      mrrDeltaPercent: number;
      estimatedChurn: number;
      netMRRDelta: number;
    }> = [];
    
    let totalOldMRR = 0;
    let totalNewMRR = 0;
    let totalSubscribers = 0;
    let totalChurn = 0;
    
    plans.forEach((plan, index) => {
      const original = originalPlans[index];
      if (!original) return;
      
      const subscribers = plan.active_subscribers_count || 0;
      const oldMRR = (original.price_monthly / 100) * subscribers;
      const newMRR = (plan.price_monthly / 100) * subscribers;
      const mrrDelta = newMRR - oldMRR;
      const mrrDeltaPercent = oldMRR > 0 ? (mrrDelta / oldMRR) * 100 : 0;
      
      // Estimation du churn basée sur l'augmentation de prix
      let estimatedChurnPercent = 0;
      if (mrrDeltaPercent > 0) {
        estimatedChurnPercent = Math.min(churnRate[0] + (mrrDeltaPercent / 5), 20);
      }
      const estimatedChurn = Math.round(subscribers * (estimatedChurnPercent / 100));
      const netMRRDelta = mrrDelta - (estimatedChurn * (plan.price_monthly / 100));
      
      totalOldMRR += oldMRR;
      totalNewMRR += newMRR;
      totalSubscribers += subscribers;
      totalChurn += estimatedChurn;
      
      if (plan.price_monthly !== original.price_monthly) {
        results.push({
          plan,
          original,
          subscribers,
          oldMRR,
          newMRR,
          mrrDelta,
          mrrDeltaPercent,
          estimatedChurn,
          netMRRDelta
        });
      }
    });
    
    return {
      results,
      totalOldMRR,
      totalNewMRR,
      totalMRRDelta: totalNewMRR - totalOldMRR,
      totalSubscribers,
      totalChurn,
      totalNetMRRDelta: (totalNewMRR - totalOldMRR) - (totalChurn * (plans.reduce((sum, p) => sum + p.price_monthly, 0) / plans.length / 100))
    };
  }, [plans, originalPlans, churnRate]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-violet-500" />
            Simulateur de revenus
          </DialogTitle>
          <DialogDescription>
            Estimez l'impact des changements de prix sur votre MRR
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Churn rate slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Taux de churn estimé</Label>
              <Badge variant="outline">{churnRate[0]}%</Badge>
            </div>
            <Slider
              value={churnRate}
              onValueChange={setChurnRate}
              min={0}
              max={20}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Pourcentage d'abonnés susceptibles de résilier suite aux changements
            </p>
          </div>
          
          <Separator />
          
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-muted-foreground">
                  {simulation.totalOldMRR.toFixed(0)}€
                </div>
                <div className="text-xs text-muted-foreground">MRR actuel</div>
              </CardContent>
            </Card>
            <Card className="bg-emerald-500/10 border-emerald-500/30">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-emerald-600 flex items-center gap-1">
                  {simulation.totalNewMRR.toFixed(0)}€
                  {simulation.totalMRRDelta > 0 && <TrendingUp className="h-4 w-4" />}
                  {simulation.totalMRRDelta < 0 && <TrendingDown className="h-4 w-4" />}
                </div>
                <div className="text-xs text-emerald-600">MRR projeté</div>
              </CardContent>
            </Card>
            <Card className={cn(
              "border",
              simulation.totalNetMRRDelta >= 0 
                ? "bg-emerald-500/10 border-emerald-500/30" 
                : "bg-red-500/10 border-red-500/30"
            )}>
              <CardContent className="pt-4">
                <div className={cn(
                  "text-2xl font-bold flex items-center gap-1",
                  simulation.totalNetMRRDelta >= 0 ? "text-emerald-600" : "text-red-600"
                )}>
                  {simulation.totalNetMRRDelta >= 0 ? "+" : ""}{simulation.totalNetMRRDelta.toFixed(0)}€
                </div>
                <div className="text-xs text-muted-foreground">Δ Net (après churn)</div>
              </CardContent>
            </Card>
          </div>
          
          {/* Detailed results */}
          {simulation.results.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Détail par plan</h4>
              {simulation.results.map(({ plan, original, subscribers, oldMRR, newMRR, mrrDelta, mrrDeltaPercent, estimatedChurn, netMRRDelta }) => (
                <Card key={plan.id} className="bg-muted/20">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={getPlanColor(plan.slug).text}>
                          {plan.name}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {subscribers} abonné{subscribers > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground line-through">
                          {formatEuros(original.price_monthly)}
                        </span>
                        <span className="font-medium">→</span>
                        <span className="font-bold text-emerald-600">
                          {formatEuros(plan.price_monthly)}
                        </span>
                        <Badge className={cn(
                          mrrDeltaPercent >= 0 
                            ? "bg-emerald-500/10 text-emerald-600" 
                            : "bg-red-500/10 text-red-600"
                        )}>
                          {mrrDeltaPercent >= 0 ? "+" : ""}{mrrDeltaPercent.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                      <span>MRR: {oldMRR.toFixed(0)}€ → {newMRR.toFixed(0)}€</span>
                      <span className="text-amber-600">
                        ⚠️ Churn estimé: ~{estimatedChurn} abonné{estimatedChurn > 1 ? 's' : ''}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calculator className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Aucun changement de prix détecté</p>
              <p className="text-sm mt-1">Modifiez le prix d'un plan pour voir la simulation</p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// EXPORT/IMPORT DIALOG
// ============================================

function ExportImportDialog({
  plans,
  addons,
  open,
  onOpenChange,
  onImport
}: {
  plans: Plan[];
  addons: Addon[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (plans: Plan[]) => void;
}) {
  const [importData, setImportData] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const exportData = useMemo(() => ({
    version: "1.0",
    exportedAt: new Date().toISOString(),
    plans: plans.map(({ active_subscribers_count, ...p }) => p),
    addons: addons.map(({ active_subscriptions_count, ...a }) => a)
  }), [plans, addons]);
  
  function handleExport() {
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `plans-config-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "✅ Export réussi", description: "Fichier téléchargé" });
  }
  
  function handleCopyToClipboard() {
    navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
    toast({ title: "📋 Copié", description: "Configuration copiée dans le presse-papier" });
  }
  
  function handleImport() {
    try {
      setImportError(null);
      const data = JSON.parse(importData);
      
      if (!data.plans || !Array.isArray(data.plans)) {
        throw new Error("Format invalide: 'plans' manquant ou invalide");
      }
      
      // Validate plans structure
      data.plans.forEach((p: any, i: number) => {
        if (!p.name || !p.slug) {
          throw new Error(`Plan ${i + 1}: 'name' ou 'slug' manquant`);
        }
      });
      
      onImport(data.plans);
      toast({ title: "✅ Import réussi", description: `${data.plans.length} plan(s) importé(s)` });
      onOpenChange(false);
    } catch (e: any) {
      setImportError(e.message);
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5 text-blue-500" />
            Export / Import Configuration
          </DialogTitle>
          <DialogDescription>
            Exportez ou importez la configuration des plans au format JSON
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="export" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export" className="gap-2">
              <Download className="h-4 w-4" />
              Exporter
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-2">
              <Upload className="h-4 w-4" />
              Importer
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="export" className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Aperçu</span>
                <Badge variant="outline">{plans.length} plans • {addons.length} add-ons</Badge>
              </div>
              <pre className="text-xs overflow-auto max-h-64 bg-background rounded p-3 border">
                {JSON.stringify(exportData, null, 2)}
              </pre>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={handleExport} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Télécharger JSON
              </Button>
              <Button variant="outline" onClick={handleCopyToClipboard}>
                <Copy className="h-4 w-4 mr-2" />
                Copier
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="import" className="space-y-4">
            <div className="space-y-2">
              <Label>Collez le JSON de configuration</Label>
              <Textarea
                value={importData}
                onChange={(e) => { setImportData(e.target.value); setImportError(null); }}
                placeholder='{"version": "1.0", "plans": [...], "addons": [...]}'
                className="font-mono text-xs min-h-[200px]"
              />
              {importError && (
                <p className="text-sm text-red-500 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  {importError}
                </p>
              )}
            </div>
            
            <Button onClick={handleImport} disabled={!importData.trim()} className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Importer la configuration
            </Button>
            
            <p className="text-xs text-muted-foreground">
              ⚠️ L'import remplacera la configuration actuelle. Pensez à exporter avant.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// EMAIL PREVIEW DIALOG
// ============================================

function EmailPreviewDialog({
  plans,
  originalPlans,
  open,
  onOpenChange
}: {
  plans: Plan[];
  originalPlans: Plan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const changedPlans = plans.filter((plan, index) => {
    const original = originalPlans[index];
    return original && plan.price_monthly !== original.price_monthly;
  });
  
  if (changedPlans.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MailOpen className="h-5 w-5 text-amber-500" />
              Aperçu de l'email
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Aucun changement de prix détecté</p>
            <p className="text-sm mt-1">Modifiez le prix d'un plan pour voir l'aperçu de l'email</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  const plan = changedPlans[0];
  const original = originalPlans.find(p => p.id === plan.id)!;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailOpen className="h-5 w-5 text-amber-500" />
            Aperçu de l'email de notification
          </DialogTitle>
          <DialogDescription>
            Cet email sera envoyé aux {plan.active_subscribers_count || 0} abonné(s) du plan {plan.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="border rounded-lg overflow-hidden bg-white">
          {/* Email Header */}
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white p-6">
            <h1 className="text-xl font-bold">📢 Évolution de votre abonnement</h1>
          </div>
          
          {/* Email Body */}
          <div className="p-6 space-y-4 text-gray-700">
            <p>Bonjour <strong>[Prénom du client]</strong>,</p>
            
            <p>
              Nous vous informons d'une évolution des tarifs de votre plan <strong>{plan.name}</strong>.
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 border">
              <h3 className="font-semibold mb-2">📊 Modification tarifaire</h3>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-gray-500 line-through text-lg">
                    {formatEuros(original.price_monthly)}/mois
                  </span>
                </div>
                <span className="text-2xl">→</span>
                <div>
                  <span className="text-violet-600 font-bold text-xl">
                    {formatEuros(plan.price_monthly)}/mois
                  </span>
                </div>
                <Badge className={cn(
                  plan.price_monthly > original.price_monthly 
                    ? "bg-amber-500/10 text-amber-600" 
                    : "bg-emerald-500/10 text-emerald-600"
                )}>
                  {plan.price_monthly > original.price_monthly ? "+" : ""}
                  {(((plan.price_monthly - original.price_monthly) / original.price_monthly) * 100).toFixed(1)}%
                </Badge>
              </div>
            </div>
            
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <h3 className="font-semibold text-emerald-800 mb-2">🛡️ Garantie de maintien de tarif</h3>
              <p className="text-emerald-700 text-sm">
                Votre tarif actuel est <strong>maintenu pendant 3 mois</strong> à compter de cette notification.
                Vous ne paierez le nouveau tarif qu'après cette période.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Vos options</h3>
              <ul className="space-y-1 text-sm">
                <li>✅ <strong>Accepter les nouvelles conditions</strong> et continuer à profiter du service</li>
                <li>↩️ <strong>Résilier sans frais</strong> avant la date d'effet</li>
                <li>📞 <strong>Nous contacter</strong> pour toute question</li>
              </ul>
            </div>
            
            <div className="text-center pt-4">
              <Button className="bg-violet-600 hover:bg-violet-700">
                Gérer mon abonnement
              </Button>
            </div>
            
            <p className="text-sm">
              Cordialement,<br />
              L'équipe Talok
            </p>
          </div>
          
          {/* Email Footer */}
          <div className="bg-gray-50 border-t p-4 text-xs text-gray-500 text-center">
            <p>
              Conformément à l'article L121-84 du Code de la consommation, vous disposez d'un droit 
              de résiliation sans frais en cas de modification des conditions contractuelles.
            </p>
            <p className="mt-2">© 2025 Talok - Tous droits réservés</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// PLAN DISTRIBUTION CHART
// ============================================

function PlanDistributionChart({ plans }: { plans: Plan[] }) {
  const totalSubscribers = plans.reduce((sum, p) => sum + (p.active_subscribers_count || 0), 0);
  
  const data = plans.map(plan => ({
    name: plan.name,
    slug: plan.slug,
    subscribers: plan.active_subscribers_count || 0,
    percentage: totalSubscribers > 0 
      ? ((plan.active_subscribers_count || 0) / totalSubscribers * 100).toFixed(1)
      : "0"
  })).filter(d => d.subscribers > 0);
  
  if (totalSubscribers === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <PieChart className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Aucun abonné pour le moment</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PieChart className="h-4 w-4" />
          Répartition des abonnés
        </CardTitle>
        <CardDescription>{totalSubscribers} abonné(s) total</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map(item => {
            const colors = getPlanColor(item.slug);
            return (
              <div key={item.slug} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className={cn("font-medium", colors.text)}>{item.name}</span>
                  <span className="text-muted-foreground">
                    {item.subscribers} ({item.percentage}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={cn("h-full rounded-full", colors.bg.replace("/10", "/60"))}
                  />
                </div>
              </div>
            );
          })}
        </div>
        
        {/* MRR Summary */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">MRR Total</span>
            <span className="font-bold text-lg">
              {formatEuros(plans.reduce((sum, p) => 
                sum + (p.price_monthly * (p.active_subscribers_count || 0)), 0
              ))}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// FEATURE USAGE STATS
// ============================================

function FeatureUsageStats({ plans }: { plans: Plan[] }) {
  const featureStats = useMemo(() => {
    const stats: Record<string, { enabled: number; total: number; label: string }> = {};
    
    FEATURE_GROUPS.forEach(group => {
      group.features.forEach(feature => {
        const enabled = plans.filter(p => {
          const val = p.features?.[feature.key as keyof PlanFeatures];
          return val === true || (typeof val === "string" && val !== "none") || (typeof val === "number" && val > 0);
        }).length;
        
        stats[feature.key] = {
          enabled,
          total: plans.length,
          label: feature.label
        };
      });
    });
    
    return Object.entries(stats)
      .map(([key, data]) => ({ key, ...data, percentage: (data.enabled / data.total) * 100 }))
      .sort((a, b) => b.percentage - a.percentage);
  }, [plans]);
  
  const topFeatures = featureStats.slice(0, 10);
  const bottomFeatures = featureStats.filter(f => f.enabled === 0);
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Utilisation des features
        </CardTitle>
        <CardDescription>Features activées par plan</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">TOP 10 FEATURES</h4>
          <div className="space-y-2">
            {topFeatures.map(feature => (
              <div key={feature.key} className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="truncate">{feature.label}</span>
                    <span className="text-muted-foreground">{feature.enabled}/{feature.total}</span>
                  </div>
                  <Progress value={feature.percentage} className="h-1.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {bottomFeatures.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">
              NON UTILISÉES ({bottomFeatures.length})
            </h4>
            <div className="flex flex-wrap gap-1">
              {bottomFeatures.slice(0, 5).map(feature => (
                <Badge key={feature.key} variant="outline" className="text-xs text-muted-foreground">
                  {feature.label}
                </Badge>
              ))}
              {bottomFeatures.length > 5 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{bottomFeatures.length - 5} autres
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// DARK MODE TOGGLE
// ============================================

function ThemeToggle({ theme, setTheme }: { theme: string; setTheme: (t: any) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0">
          {theme === "light" && <Sun className="h-4 w-4" />}
          {theme === "dark" && <Moon className="h-4 w-4" />}
          {theme === "system" && <Laptop className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="h-4 w-4 mr-2" />
          Clair
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="h-4 w-4 mr-2" />
          Sombre
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Laptop className="h-4 w-4 mr-2" />
          Système
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================
// BACKUP INDICATOR
// ============================================

function BackupIndicator({ hasBackup }: { hasBackup: boolean }) {
  const [showRestore, setShowRestore] = useState(false);
  
  if (!hasBackup) return null;
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground">
          <HardDrive className="h-3 w-3" />
          <span className="text-xs">Backup</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Auto-backup actif</h4>
          <p className="text-xs text-muted-foreground">
            Vos modifications sont sauvegardées localement toutes les 30 secondes.
          </p>
          <Button variant="outline" size="sm" className="w-full" onClick={() => setShowRestore(true)}>
            Restaurer depuis le backup
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ============================================
// BULK ACTIONS BAR
// ============================================

function BulkActionsBar({
  selectedPlans,
  plans,
  onSelectAll,
  onDeselectAll,
  onBulkUpdate,
  onClose
}: {
  selectedPlans: Set<string>;
  plans: Plan[];
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkUpdate: (updates: Partial<Plan>) => void;
  onClose: () => void;
}) {
  const allSelected = selectedPlans.size === plans.length;
  const someSelected = selectedPlans.size > 0 && selectedPlans.size < plans.length;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
    >
      <Card className="shadow-2xl border-2">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={allSelected ? onDeselectAll : onSelectAll}
              >
                {allSelected ? (
                  <CheckSquare className="h-4 w-4" />
                ) : someSelected ? (
                  <Minus className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </Button>
              <span className="text-sm font-medium">
                {selectedPlans.size} sélectionné{selectedPlans.size > 1 ? 's' : ''}
              </span>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkUpdate({ is_active: true })}
              >
                <Check className="h-3 w-3 mr-1" />
                Activer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onBulkUpdate({ is_active: false })}
              >
                <X className="h-3 w-3 mr-1" />
                Désactiver
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Zap className="h-3 w-3 mr-1" />
                    Features
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Activer feature</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onBulkUpdate({ features: { signatures: true } } as any)}>
                    E-signatures
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onBulkUpdate({ features: { ocr_documents: true } } as any)}>
                    OCR Documents
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onBulkUpdate({ features: { scoring_ia: true } } as any)}>
                    Scoring IA
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Désactiver feature</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onBulkUpdate({ features: { signatures: false } } as any)}>
                    E-signatures
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onBulkUpdate({ features: { ocr_documents: false } } as any)}>
                    OCR Documents
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function AdminPlansPage() {
  // State
  const [plans, setPlans] = useState<Plan[]>([]);
  const [originalPlans, setOriginalPlans] = useState<Plan[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("plans");
  
  // Sheet state
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  
  // Dialogs
  const [commandOpen, setCommandOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [exportImportOpen, setExportImportOpen] = useState(false);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);
  
  // Selection for bulk actions
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  
  // Save status
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  
  // Undo/Redo
  const [history, setHistory] = useState<Plan[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Theme
  const [theme, setTheme] = useLocalStorage<"light" | "dark" | "system">("admin-theme", "system");
  
  // Hooks
  const reducedMotion = useReducedMotion();
  useAutoBackup(plans, "admin-plans");
  
  const { toast } = useToast();
  
  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================
  
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "z") {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === "Escape") {
        if (sheetOpen) setSheetOpen(false);
        if (bulkMode) {
          setBulkMode(false);
          setSelectedPlans(new Set());
        }
      }
    }
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sheetOpen, historyIndex, history, bulkMode]);
  
  // ============================================
  // DATA FETCHING
  // ============================================
  
  useEffect(() => {
    fetchData();
  }, []);
  
  async function fetchData() {
    setLoading(true);
    try {
      const [plansRes, addonsRes] = await Promise.all([
        fetch("/api/admin/plans"),
        fetch("/api/admin/addons")
      ]);
      
      const plansData = await plansRes.json();
      const addonsData = await addonsRes.json();
      
      if (plansData.error) throw new Error(plansData.error);
      
      const sortedPlans = (plansData.plans || []).sort((a: Plan, b: Plan) => a.display_order - b.display_order);
      setPlans(sortedPlans);
      setOriginalPlans(JSON.parse(JSON.stringify(sortedPlans)));
      setAddons(addonsData.addons || []);
      setHistory([JSON.parse(JSON.stringify(sortedPlans))]);
      setHistoryIndex(0);
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  
  // ============================================
  // COMPUTED VALUES
  // ============================================
  
  const hasChanges = useMemo(() => {
    return JSON.stringify(plans) !== JSON.stringify(originalPlans);
  }, [plans, originalPlans]);
  
  const changedPlansCount = useMemo(() => {
    return plans.filter((plan, index) => 
      JSON.stringify(plan) !== JSON.stringify(originalPlans[index])
    ).length;
  }, [plans, originalPlans]);
  
  const affectedSubscribers = useMemo(() => {
    let count = 0;
    plans.forEach((plan, index) => {
      const original = originalPlans[index];
      if (original && (plan.price_monthly !== original.price_monthly)) {
        count += plan.active_subscribers_count || 0;
      }
    });
    return count;
  }, [plans, originalPlans]);
  
  // ============================================
  // ACTIONS
  // ============================================
  
  function pushToHistory(newPlans: Plan[]) {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newPlans)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }
  
  function updatePlan(planId: string, updates: Partial<Plan>) {
    const newPlans = plans.map(p => p.id === planId ? { ...p, ...updates } : p);
    setPlans(newPlans);
    pushToHistory(newPlans);
  }
  
  function updateFeature(planId: string, featureKey: string, value: any) {
    const newPlans = plans.map(p => {
      if (p.id !== planId) return p;
      return { ...p, features: { ...p.features, [featureKey]: value } };
    });
    setPlans(newPlans);
    pushToHistory(newPlans);
  }
  
  function handleReorder(newOrder: Plan[]) {
    const reorderedPlans = newOrder.map((plan, index) => ({
      ...plan,
      display_order: index
    }));
    setPlans(reorderedPlans);
    pushToHistory(reorderedPlans);
  }
  
  function handleUndo() {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setPlans(JSON.parse(JSON.stringify(history[historyIndex - 1])));
      toast({ title: "↩️ Annulé" });
    }
  }
  
  function handleRedo() {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setPlans(JSON.parse(JSON.stringify(history[historyIndex + 1])));
      toast({ title: "↪️ Refait" });
    }
  }
  
  function resetChanges() {
    setPlans(JSON.parse(JSON.stringify(originalPlans)));
    toast({ title: "Modifications annulées" });
  }
  
  function duplicatePlan(plan: Plan) {
    const newPlan: Plan = {
      ...plan,
      id: `temp-${Date.now()}`,
      name: `${plan.name} (copie)`,
      slug: `${plan.slug}-copy`,
      is_popular: false,
      display_order: plans.length,
      active_subscribers_count: 0
    };
    const newPlans = [...plans, newPlan];
    setPlans(newPlans);
    pushToHistory(newPlans);
    toast({ title: "Plan dupliqué", description: `"${newPlan.name}" créé` });
  }
  
  // Bulk actions
  function togglePlanSelection(planId: string) {
    const newSelected = new Set(selectedPlans);
    if (newSelected.has(planId)) {
      newSelected.delete(planId);
    } else {
      newSelected.add(planId);
    }
    setSelectedPlans(newSelected);
    if (newSelected.size > 0 && !bulkMode) setBulkMode(true);
    if (newSelected.size === 0) setBulkMode(false);
  }
  
  function selectAllPlans() {
    setSelectedPlans(new Set(plans.map(p => p.id)));
    setBulkMode(true);
  }
  
  function deselectAllPlans() {
    setSelectedPlans(new Set());
    setBulkMode(false);
  }
  
  function bulkUpdatePlans(updates: Partial<Plan>) {
    const newPlans = plans.map(p => {
      if (!selectedPlans.has(p.id)) return p;
      
      // Handle feature updates specially
      if (updates.features) {
        return {
          ...p,
          features: { ...p.features, ...updates.features }
        };
      }
      return { ...p, ...updates };
    });
    setPlans(newPlans);
    pushToHistory(newPlans);
    toast({ 
      title: "Mise à jour groupée", 
      description: `${selectedPlans.size} plan(s) modifié(s)` 
    });
  }
  
  async function handleSave() {
    if (!hasChanges) return;
    
    setSaving(true);
    setSaveStatus("saving");
    
    try {
      const modifiedPlans = plans.filter((plan, index) => 
        JSON.stringify(plan) !== JSON.stringify(originalPlans[index])
      );
      
      for (const plan of modifiedPlans) {
        const res = await fetch("/api/admin/plans", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(plan),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }
      
      setSaveStatus("saved");
      setOriginalPlans(JSON.parse(JSON.stringify(plans)));
      toast({ title: "✅ Sauvegardé", description: `${modifiedPlans.length} plan(s) mis à jour` });
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (error: any) {
      setSaveStatus("error");
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }
  
  function openPlanSheet(plan: Plan) {
    setSelectedPlan(plan);
    setSheetOpen(true);
  }
  
  function handleImportPlans(importedPlans: Plan[]) {
    // Merge imported plans with existing ones, update if slug matches
    const newPlans = [...plans];
    importedPlans.forEach(imported => {
      const existingIndex = newPlans.findIndex(p => p.slug === imported.slug);
      if (existingIndex >= 0) {
        newPlans[existingIndex] = { ...newPlans[existingIndex], ...imported };
      } else {
        newPlans.push({ ...imported, id: `imported-${Date.now()}-${Math.random()}` });
      }
    });
    setPlans(newPlans);
    pushToHistory(newPlans);
  }
  
  // Check for backup
  const hasBackup = useMemo(() => {
    try {
      return !!localStorage.getItem("admin-plans_backup");
    } catch {
      return false;
    }
  }, []);
  
  // ============================================
  // RENDER
  // ============================================
  
  if (loading) return <PageSkeleton />;
  
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg"
        >
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                  <Package className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">Forfaits & Tarifs</h1>
                  <p className="text-xs text-muted-foreground">
                    {plans.length} plans • {addons.length} add-ons
                  </p>
                </div>
              </div>
              
              <AnimatePresence mode="wait">
                {saveStatus !== "idle" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                      saveStatus === "saving" && "bg-blue-500/10 text-blue-600",
                      saveStatus === "saved" && "bg-emerald-500/10 text-emerald-600",
                      saveStatus === "error" && "bg-red-500/10 text-red-600"
                    )}
                  >
                    {saveStatus === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
                    {saveStatus === "saved" && <CheckCircle2 className="h-3 w-3" />}
                    {saveStatus === "error" && <XCircle className="h-3 w-3" />}
                    {saveStatus === "saving" && "Sauvegarde..."}
                    {saveStatus === "saved" && "Sauvegardé"}
                    {saveStatus === "error" && "Erreur"}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="flex items-center gap-2">
              <AnimatePresence>
                {hasChanges && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                    <Badge 
                      variant="secondary" 
                      className="bg-amber-500/10 text-amber-600 border-amber-500/20 cursor-pointer hover:bg-amber-500/20"
                      onClick={() => setSimulatorOpen(true)}
                    >
                      <Calculator className="h-3 w-3 mr-1" />
                      {changedPlansCount} modif{changedPlansCount > 1 ? 's' : ''}
                      {affectedSubscribers > 0 && <span className="ml-1 opacity-70">• {affectedSubscribers} abonné{affectedSubscribers > 1 ? 's' : ''}</span>}
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Command palette */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCommandOpen(true)}>
                    <Search className="h-4 w-4" />
                    <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px]">
                      <Command className="h-3 w-3" />K
                    </kbd>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Recherche rapide</TooltipContent>
              </Tooltip>
              
              {/* Undo/Redo */}
              <div className="flex items-center border rounded-lg">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-r-none" onClick={handleUndo} disabled={historyIndex <= 0}>
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Annuler (⌘Z)</TooltipContent>
                </Tooltip>
                <Separator orientation="vertical" className="h-4" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-l-none" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
                      <Redo2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refaire (⌘⇧Z)</TooltipContent>
                </Tooltip>
              </div>
              
              {/* Revenue Simulator */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setSimulatorOpen(true)}>
                    <Calculator className="h-4 w-4 mr-1" />
                    Simulateur
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Simuler l'impact des changements</TooltipContent>
              </Tooltip>
              
              {/* Email Preview */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setEmailPreviewOpen(true)}>
                    <Mail className="h-4 w-4 mr-1" />
                    Email
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Aperçu de l'email de notification</TooltipContent>
              </Tooltip>
              
              {/* Export/Import */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setExportImportOpen(true)}>
                    <FileJson className="h-4 w-4 mr-1" />
                    JSON
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export/Import configuration</TooltipContent>
              </Tooltip>
              
              {/* Backup Indicator */}
              <BackupIndicator hasBackup={hasBackup} />
              
              {/* Theme Toggle */}
              <ThemeToggle theme={theme} setTheme={setTheme} />
              
              {/* Preview */}
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-1" />
                Preview
              </Button>
              
              {/* Reset */}
              <Button variant="outline" size="sm" onClick={resetChanges} disabled={!hasChanges}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              
              {/* Save */}
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Sauvegarder
                <kbd className="hidden sm:inline-flex ml-2 h-5 items-center gap-1 rounded border border-emerald-400/30 bg-emerald-400/20 px-1.5 font-mono text-[10px]">⌘S</kbd>
              </Button>
            </div>
          </div>
        </motion.header>
        
        {/* Main Content */}
        <main className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between mb-6">
              <TabsList>
                <TabsTrigger value="plans" className="gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  Plans ({plans.length})
                </TabsTrigger>
                <TabsTrigger value="addons" className="gap-2">
                  <Zap className="h-4 w-4" />
                  Add-ons ({addons.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2">
                  <History className="h-4 w-4" />
                  Historique
                </TabsTrigger>
                <TabsTrigger value="stats" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Stats
                </TabsTrigger>
              </TabsList>
              
              {activeTab === "plans" && (
                <div className="flex items-center gap-2">
                  <Button
                    variant={bulkMode ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (bulkMode) {
                        setBulkMode(false);
                        setSelectedPlans(new Set());
                      } else {
                        setBulkMode(true);
                      }
                    }}
                  >
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Sélection
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    💡 Glissez pour réordonner • Double-cliquez sur un prix pour le modifier
                  </p>
                </div>
              )}
            </div>
            
            {/* PLANS TAB */}
            <TabsContent value="plans">
              <Reorder.Group
                axis="x"
                values={plans}
                onReorder={handleReorder}
                className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
              >
                {plans.map((plan, index) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    original={originalPlans[index]}
                    onEdit={() => openPlanSheet(plan)}
                    onUpdate={(updates) => updatePlan(plan.id, updates)}
                    onDuplicate={() => duplicatePlan(plan)}
                    isSelected={selectedPlans.has(plan.id)}
                    onToggleSelect={() => togglePlanSelection(plan.id)}
                    bulkMode={bulkMode}
                  />
                ))}
              </Reorder.Group>
            </TabsContent>
            
            {/* ADDONS TAB */}
            <TabsContent value="addons">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {addons.map((addon) => (
                  <AddonCard key={addon.id} addon={addon} />
                ))}
              </div>
            </TabsContent>
            
            {/* HISTORY TAB */}
            <TabsContent value="history">
              <HistoryTab plans={plans} />
            </TabsContent>
            
            {/* STATS TAB */}
            <TabsContent value="stats">
              <div className="grid gap-6 md:grid-cols-2">
                <PlanDistributionChart plans={plans} />
                <FeatureUsageStats plans={plans} />
              </div>
            </TabsContent>
          </Tabs>
        </main>
        
        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {bulkMode && selectedPlans.size > 0 && (
            <BulkActionsBar
              selectedPlans={selectedPlans}
              plans={plans}
              onSelectAll={selectAllPlans}
              onDeselectAll={deselectAllPlans}
              onBulkUpdate={bulkUpdatePlans}
              onClose={() => { setBulkMode(false); setSelectedPlans(new Set()); }}
            />
          )}
        </AnimatePresence>
        
        {/* Sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            {selectedPlan && (
              <PlanEditSheet
                plan={selectedPlan}
                onUpdate={(updates) => {
                  updatePlan(selectedPlan.id, updates);
                  setSelectedPlan({ ...selectedPlan, ...updates });
                }}
                onUpdateFeature={(key, value) => {
                  updateFeature(selectedPlan.id, key, value);
                  setSelectedPlan({
                    ...selectedPlan,
                    features: { ...selectedPlan.features, [key]: value }
                  });
                }}
                onClose={() => setSheetOpen(false)}
              />
            )}
          </SheetContent>
        </Sheet>
        
        {/* Command Palette */}
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandInput placeholder="Rechercher..." />
          <CommandList>
            <CommandEmpty>Aucun résultat.</CommandEmpty>
            <CommandGroup heading="Plans">
              {plans.map(plan => (
                <CommandItem key={plan.id} onSelect={() => { openPlanSheet(plan); setCommandOpen(false); }}>
                  <Package className="mr-2 h-4 w-4" />
                  <span>Modifier {plan.name}</span>
                  <CommandShortcut>{formatEuros(plan.price_monthly)}/m</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => { handleSave(); setCommandOpen(false); }}>
                <Save className="mr-2 h-4 w-4" />
                <span>Sauvegarder</span>
                <CommandShortcut>⌘S</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => { setSimulatorOpen(true); setCommandOpen(false); }}>
                <Calculator className="mr-2 h-4 w-4" />
                <span>Simulateur de revenus</span>
              </CommandItem>
              <CommandItem onSelect={() => { setPreviewOpen(true); setCommandOpen(false); }}>
                <Eye className="mr-2 h-4 w-4" />
                <span>Prévisualiser</span>
              </CommandItem>
              <CommandItem onSelect={() => { handleUndo(); setCommandOpen(false); }}>
                <Undo2 className="mr-2 h-4 w-4" />
                <span>Annuler</span>
                <CommandShortcut>⌘Z</CommandShortcut>
              </CommandItem>
              <CommandItem onSelect={() => { setExportImportOpen(true); setCommandOpen(false); }}>
                <FileJson className="mr-2 h-4 w-4" />
                <span>Export/Import JSON</span>
              </CommandItem>
              <CommandItem onSelect={() => { setEmailPreviewOpen(true); setCommandOpen(false); }}>
                <Mail className="mr-2 h-4 w-4" />
                <span>Aperçu email notification</span>
              </CommandItem>
              <CommandItem onSelect={() => { setActiveTab("stats"); setCommandOpen(false); }}>
                <BarChart3 className="mr-2 h-4 w-4" />
                <span>Statistiques</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
        
        {/* Revenue Simulator */}
        <RevenueSimulator
          plans={plans}
          originalPlans={originalPlans}
          open={simulatorOpen}
          onOpenChange={setSimulatorOpen}
        />
        
        {/* Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-6xl h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Prévisualisation
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 rounded-lg border overflow-hidden bg-white">
              <iframe src="/pricing" className="w-full h-full" title="Preview" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fermer</Button>
              <Button onClick={() => window.open("/pricing", "_blank")}>
                <ExternalLink className="h-4 w-4 mr-1" />
                Nouvel onglet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Export/Import Dialog */}
        <ExportImportDialog
          plans={plans}
          addons={addons}
          open={exportImportOpen}
          onOpenChange={setExportImportOpen}
          onImport={handleImportPlans}
        />
        
        {/* Email Preview Dialog */}
        <EmailPreviewDialog
          plans={plans}
          originalPlans={originalPlans}
          open={emailPreviewOpen}
          onOpenChange={setEmailPreviewOpen}
        />
      </div>
    </TooltipProvider>
  );
}

// ============================================
// PLAN CARD (with Drag & Drop + Selection)
// ============================================

const PlanCard = memo(function PlanCard({
  plan,
  original,
  onEdit,
  onUpdate,
  onDuplicate,
  isSelected,
  onToggleSelect,
  bulkMode
}: {
  plan: Plan;
  original: Plan;
  onEdit: () => void;
  onUpdate: (updates: Partial<Plan>) => void;
  onDuplicate: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
  bulkMode: boolean;
}) {
  const colors = getPlanColor(plan.slug);
  const hasChanges = JSON.stringify(plan) !== JSON.stringify(original);
  const priceChanged = plan.price_monthly !== original?.price_monthly;
  const featuresCount = countActiveFeatures(plan.features);
  const dragControls = useDragControls();
  
  return (
    <Reorder.Item
      value={plan}
      dragListener={false}
      dragControls={dragControls}
    >
      <motion.div
        layout
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        <Card 
          className={cn(
            "relative overflow-hidden transition-all cursor-pointer",
            "hover:shadow-xl hover:shadow-black/5",
            hasChanges && "ring-2 ring-amber-500/50",
            isSelected && `ring-2 ${colors.ring}`,
            !plan.is_active && "opacity-60"
          )}
          onClick={bulkMode ? onToggleSelect : onEdit}
        >
          {/* Gradient */}
          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", colors.gradient)} />
          
          {/* Drag handle */}
          <div
            className="absolute top-3 left-2 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted/50 z-10"
            onPointerDown={(e) => {
              e.stopPropagation();
              dragControls.start(e);
            }}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          
          {/* Selection checkbox */}
          {bulkMode && (
            <div className="absolute top-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
              <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
            </div>
          )}
          
          {/* Popular badge */}
          {plan.is_popular && (
            <motion.div initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} className="absolute -top-1 left-1/2 -translate-x-1/2 z-10">
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg">
                <Sparkles className="h-3 w-3 mr-1" />
                Populaire
              </Badge>
            </motion.div>
          )}
          
          {/* Changes indicator */}
          {hasChanges && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-3 left-8">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            </motion.div>
          )}
          
          <CardHeader className="relative pb-2 pt-6">
            <div className="flex items-start justify-between">
              <div className="pl-4">
                <CardTitle className={cn("text-lg font-bold", colors.text)}>{plan.name}</CardTitle>
                <CardDescription className="line-clamp-1 text-xs mt-0.5">{plan.description}</CardDescription>
              </div>
              {!bulkMode && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
                      <Copy className="h-4 w-4 mr-2" />
                      Dupliquer
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdate({ is_popular: !plan.is_popular }); }}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {plan.is_popular ? "Retirer populaire" : "Marquer populaire"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUpdate({ is_active: !plan.is_active }); }}>
                      {plan.is_active ? <X className="h-4 w-4 mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                      {plan.is_active ? "Désactiver" : "Activer"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="relative pt-0 space-y-4 pl-8">
            {/* Price */}
            <div className="flex items-baseline gap-1" onClick={(e) => e.stopPropagation()}>
              <span className={cn("text-3xl font-bold tabular-nums", priceChanged && "text-amber-600")}>
                <InlinePriceEditor
                  value={plan.price_monthly}
                  onChange={(cents) => onUpdate({ price_monthly: cents })}
                />
              </span>
              <span className="text-sm text-muted-foreground">/mois</span>
              {priceChanged && original && (
                <span className="text-xs text-muted-foreground line-through ml-2">
                  {formatEuros(original.price_monthly)}
                </span>
              )}
            </div>
            
            {/* Stats */}
            <div className="flex gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                <Home className="h-3 w-3 mr-1" />
                {plan.max_properties === -1 ? "∞" : plan.max_properties} biens
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                {featuresCount} features
              </Badge>
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {plan.active_subscribers_count || 0} abonné{(plan.active_subscribers_count || 0) > 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={plan.is_active}
                  onCheckedChange={(active) => onUpdate({ is_active: active })}
                  className="scale-75"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Reorder.Item>
  );
});

// ============================================
// PLAN EDIT SHEET
// ============================================

function PlanEditSheet({
  plan,
  onUpdate,
  onUpdateFeature,
  onClose
}: {
  plan: Plan;
  onUpdate: (updates: Partial<Plan>) => void;
  onUpdateFeature: (key: string, value: any) => void;
  onClose: () => void;
}) {
  const colors = getPlanColor(plan.slug);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["documents"]));
  
  function toggleGroup(groupId: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }
  
  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-3">
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", colors.bg, colors.border, "border")}>
            <Package className={cn("h-5 w-5", colors.text)} />
          </div>
          <div>
            <span className={colors.text}>{plan.name}</span>
            {plan.is_popular && (
              <Badge className="ml-2 bg-amber-500/10 text-amber-600 border-amber-500/20">
                <Sparkles className="h-3 w-3 mr-1" />Populaire
              </Badge>
            )}
          </div>
        </SheetTitle>
        <SheetDescription>Modifiez les paramètres de ce plan</SheetDescription>
      </SheetHeader>
      
      <ScrollArea className="flex-1 -mx-6 px-6">
        <div className="space-y-6 py-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4" />Informations
            </h3>
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={plan.description} onChange={(e) => onUpdate({ description: e.target.value })} className="resize-none" rows={2} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prix mensuel</Label>
                  <div className="relative">
                    <Input type="number" value={centsToEuros(plan.price_monthly)} onChange={(e) => onUpdate({ price_monthly: eurosToCents(parseFloat(e.target.value) || 0) })} className="pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Prix annuel</Label>
                  <div className="relative">
                    <Input type="number" value={centsToEuros(plan.price_yearly)} onChange={(e) => onUpdate({ price_yearly: eurosToCents(parseFloat(e.target.value) || 0) })} className="pr-8" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <Separator />
          
          {/* Limits */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />Limites
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Home className="h-3 w-3" />Biens max</Label>
                <Input type="number" value={plan.max_properties === -1 ? "" : plan.max_properties} onChange={(e) => onUpdate({ max_properties: e.target.value ? parseInt(e.target.value) : -1 })} placeholder="∞ Illimité" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Upload className="h-3 w-3" />Stockage (Go)</Label>
                <Input type="number" value={plan.max_documents_gb === -1 ? "" : plan.max_documents_gb} onChange={(e) => onUpdate({ max_documents_gb: e.target.value ? parseInt(e.target.value) : -1 })} placeholder="∞ Illimité" />
              </div>
            </div>
          </div>
          
          <Separator />
          
          {/* Features */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4" />Fonctionnalités
            </h3>
            <div className="space-y-2">
              {FEATURE_GROUPS.map((group) => (
                <Collapsible key={group.id} open={expandedGroups.has(group.id)} onOpenChange={() => toggleGroup(group.id)}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between h-auto py-2 px-3 hover:bg-muted/50">
                      <span className="flex items-center gap-2 text-sm">
                        <group.icon className="h-4 w-4 text-muted-foreground" />{group.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {group.features.filter(f => {
                            const val = plan.features?.[f.key as keyof PlanFeatures];
                            return val === true || (typeof val === "string" && val !== "none") || (typeof val === "number" && val !== 0);
                          }).length}/{group.features.length}
                        </Badge>
                        {expandedGroups.has(group.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2 py-2 pl-6">
                      {group.features.map((feature) => (
                        <FeatureRow
                          key={feature.key}
                          feature={feature}
                          value={plan.features?.[feature.key as keyof PlanFeatures]}
                          onChange={(val) => onUpdateFeature(feature.key, val)}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
      
      <SheetFooter className="border-t pt-4">
        <Button variant="outline" onClick={onClose}>Fermer</Button>
      </SheetFooter>
    </>
  );
}

// ============================================
// FEATURE ROW
// ============================================

function FeatureRow({ feature, value, onChange }: { feature: any; value: any; onChange: (val: any) => void }) {
  if (feature.type === "boolean") {
    return (
      <div className="flex items-center justify-between py-1.5">
        <Label className="text-sm font-normal cursor-pointer" htmlFor={feature.key}>{feature.label}</Label>
        <Switch id={feature.key} checked={!!value} onCheckedChange={onChange} />
      </div>
    );
  }
  
  if (feature.type === "number") {
    const isUnlimited = value === feature.unlimited;
    return (
      <div className="flex items-center justify-between py-1.5">
        <Label className="text-sm font-normal">{feature.label}</Label>
        <div className="flex items-center gap-2">
          {isUnlimited ? (
            <Button variant="outline" size="sm" className="h-8 px-3 font-mono text-emerald-600" onClick={() => onChange(0)}>∞</Button>
          ) : (
            <Input type="number" value={value ?? 0} onChange={(e) => onChange(parseInt(e.target.value) || 0)} className="w-20 h-8 text-center" />
          )}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => onChange(isUnlimited ? 0 : feature.unlimited)}>
            {isUnlimited ? "∅" : "∞"}
          </Button>
        </div>
      </div>
    );
  }
  
  if (feature.type === "level" && feature.levels) {
    return (
      <div className="flex items-center justify-between py-1.5">
        <Label className="text-sm font-normal">{feature.label}</Label>
        <Select value={value || "none"} onValueChange={onChange}>
          <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {feature.levels.map((level: string) => (
              <SelectItem key={level} value={level}>{LEVEL_LABELS[level] || level}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  
  return null;
}

// ============================================
// ADDON CARD
// ============================================

function AddonCard({ addon }: { addon: Addon }) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
      <Card className={cn(!addon.is_active && "opacity-60")}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{addon.name}</CardTitle>
              <CardDescription className="text-xs mt-1 line-clamp-2">{addon.description}</CardDescription>
            </div>
            <Badge className="bg-violet-500/10 text-violet-600 border-violet-500/20 font-mono">
              {formatEuros(addon.price_monthly)}/m
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-center gap-1 flex-wrap mb-3">
            {addon.compatible_plans.map(p => (
              <Badge key={p} variant="outline" className="text-xs capitalize">{p}</Badge>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />{addon.active_subscriptions_count || 0} souscription(s)
            </span>
            <Button variant="ghost" size="sm" className="h-7"><Edit className="h-3.5 w-3.5" /></Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================
// HISTORY TAB
// ============================================

function HistoryTab({ plans }: { plans: Plan[] }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch("/api/admin/plans/history");
        const data = await res.json();
        setHistory(data.history || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-medium">Aucun historique</p>
            <p className="text-sm mt-1">Les modifications seront enregistrées ici.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      {history.map((entry: any) => (
        <Card key={entry.id}>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{entry.plan_name || "Plan"}</Badge>
                {entry.old_price_monthly !== entry.new_price_monthly && (
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Prix modifié</Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(entry.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground">{entry.change_reason}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
