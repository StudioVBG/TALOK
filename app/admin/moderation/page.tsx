"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Shield,
  AlertTriangle,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  Brain,
  Sparkles,
  Clock,
  Filter,
  Search,
  RefreshCw,
  ChevronRight,
  Settings,
  Zap,
  BarChart3,
  Users,
  FileText,
  MessageSquare,
  Home,
  CreditCard,
  Star,
  ArrowUpRight,
  Pause,
  Play,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
import { cn } from "@/lib/utils";

// Types
interface ModerationRule {
  id: string;
  name: string;
  description: string;
  flow_type: string;
  ai_enabled: boolean;
  ai_model: string;
  ai_threshold: number;
  rule_config: Record<string, unknown>;
  auto_action: string;
  is_active: boolean;
  priority: number;
  total_triggered: number;
  accuracy_rate: number;
  created_at: string;
}

interface ModerationQueueItem {
  id: string;
  entity_type: string;
  entity_id: string;
  rule_id: string | null;
  ai_score: number;
  ai_reasoning: string;
  ai_suggested_action: string;
  flagged_content: string;
  matched_patterns: string[];
  status: string;
  priority: string;
  assigned_to: string | null;
  created_at: string;
}

interface ModerationStats {
  pending: number;
  reviewing: number;
  approved: number;
  rejected: number;
  escalated: number;
  byPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byType: Record<string, number>;
  rulesActive: number;
  avgResolutionHours: number;
}

const FLOW_TYPES = [
  { value: "profile", label: "Profil", icon: Users },
  { value: "message", label: "Message", icon: MessageSquare },
  { value: "document", label: "Document", icon: FileText },
  { value: "listing", label: "Annonce", icon: Home },
  { value: "payment", label: "Paiement", icon: CreditCard },
  { value: "review", label: "Avis", icon: Star },
];

const AUTO_ACTIONS = [
  { value: "flag", label: "Signaler", color: "text-amber-500" },
  { value: "quarantine", label: "Quarantaine", color: "text-orange-500" },
  { value: "reject", label: "Rejeter", color: "text-red-500" },
  { value: "escalate", label: "Escalader", color: "text-purple-500" },
  { value: "notify", label: "Notifier", color: "text-blue-500" },
];

const PRIORITY_COLORS = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-green-500",
};

export default function AdminModerationPage() {
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();

  // States
  const [rules, setRules] = useState<ModerationRule[]>([]);
  const [queue, setQueue] = useState<ModerationQueueItem[]>([]);
  const [stats, setStats] = useState<ModerationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("queue");

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ModerationQueueItem | null>(null);

  // Filter states
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // New rule form
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    flow_type: "profile",
    ai_enabled: true,
    ai_threshold: 0.75,
    rule_config: "{}",
    auto_action: "flag",
    priority: 50,
  });

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!user || profile?.role !== "admin") return;

    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      // Fetch rules
      const rulesRes = await fetch("/api/admin/moderation/rules", {
        credentials: "include",
        headers,
      });
      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setRules(data.rules || []);
      }

      // Fetch queue
      const queueRes = await fetch("/api/admin/moderation/queue", {
        credentials: "include",
        headers,
      });
      if (queueRes.ok) {
        const data = await queueRes.json();
        setQueue(data.items || []);
      }

      // Fetch stats via RPC
      const { data: statsData } = await supabase.rpc("get_moderation_stats");
      if (statsData) {
        setStats(statsData as ModerationStats);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Impossible de charger les données";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, profile, toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== "admin") return;
    fetchData();
  }, [user, profile, authLoading, fetchData]);

  // Create rule
  async function handleCreateRule() {
    if (!newRule.name || !newRule.flow_type) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    try {
      let ruleConfig = {};
      try {
        ruleConfig = JSON.parse(newRule.rule_config);
      } catch {
        toast({
          title: "JSON invalide",
          description: "La configuration doit être un JSON valide",
          variant: "destructive",
        });
        return;
      }

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch("/api/admin/moderation/rules", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          name: newRule.name,
          description: newRule.description,
          flow_type: newRule.flow_type,
          ai_enabled: newRule.ai_enabled,
          ai_threshold: newRule.ai_threshold,
          rule_config: ruleConfig,
          auto_action: newRule.auto_action,
          priority: newRule.priority,
          is_active: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la création");
      }

      toast({
        title: "Règle créée",
        description: "La règle de modération IA a été créée avec succès.",
      });

      setCreateDialogOpen(false);
      setNewRule({
        name: "",
        description: "",
        flow_type: "profile",
        ai_enabled: true,
        ai_threshold: 0.75,
        rule_config: "{}",
        auto_action: "flag",
        priority: 50,
      });
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Impossible de créer la règle";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  // Moderate item
  async function handleModerate(item: ModerationQueueItem, action: "approve" | "reject") {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`/api/admin/moderation/queue/${item.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          status: action === "approve" ? "approved" : "rejected",
          action_taken: action,
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la modération");
      }

      toast({
        title: action === "approve" ? "Approuvé" : "Rejeté",
        description: `L'élément a été ${action === "approve" ? "approuvé" : "rejeté"}.`,
      });

      setDetailSheetOpen(false);
      setSelectedItem(null);
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur lors de la modération";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  // Toggle rule
  async function handleToggleRule(rule: ModerationRule) {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`/api/admin/moderation/rules/${rule.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({
          is_active: !rule.is_active,
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la mise à jour");
      }

      toast({
        title: rule.is_active ? "Règle désactivée" : "Règle activée",
      });

      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }

  // Filter queue
  const filteredQueue = queue.filter((item) => {
    if (filterPriority !== "all" && item.priority !== filterPriority) return false;
    if (filterType !== "all" && item.entity_type !== filterType) return false;
    if (searchQuery && !item.flagged_content?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getFlowIcon = (type: string) => {
    const flow = FLOW_TYPES.find((f) => f.value === type);
    return flow?.icon || FileText;
  };

  if (authLoading || loading) {
    return (
      <div className="py-8 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Brain className="h-8 w-8 text-primary" />
              Modération IA-First
            </h1>
            <p className="text-muted-foreground mt-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Gestion intelligente du contenu avec scoring IA automatique
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle règle
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className={cn(
              "border-l-4 border-l-amber-500",
              stats.pending > 10 && "bg-amber-500/5"
            )}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">En attente</p>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                  </div>
                  <Clock className="h-8 w-8 text-amber-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Critiques</p>
                    <p className="text-2xl font-bold text-red-500">{stats.byPriority?.critical || 0}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Approuvés</p>
                    <p className="text-2xl font-bold text-green-500">{stats.approved}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Escaladés</p>
                    <p className="text-2xl font-bold text-purple-500">{stats.escalated}</p>
                  </div>
                  <ArrowUpRight className="h-8 w-8 text-purple-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Règles actives</p>
                    <p className="text-2xl font-bold">{stats.rulesActive}</p>
                  </div>
                  <Zap className="h-8 w-8 text-blue-500 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-slate-500">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Temps moyen</p>
                    <p className="text-2xl font-bold">{stats.avgResolutionHours || 0}h</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-slate-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="queue" className="gap-2">
              <Shield className="h-4 w-4" />
              File de modération
              {stats && stats.pending > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {stats.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-2">
              <Settings className="h-4 w-4" />
              Règles IA
            </TabsTrigger>
          </TabsList>

          {/* Queue Tab */}
          <TabsContent value="queue" className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher dans le contenu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Priorité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes priorités</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="low">Basse</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  {FLOW_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Queue list */}
            <Card>
              <CardContent className="p-0">
                {filteredQueue.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p className="text-lg font-medium">File de modération vide</p>
                    <p className="text-muted-foreground">Aucun élément en attente de révision</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    <AnimatePresence mode="popLayout">
                      {filteredQueue.map((item) => {
                        const Icon = getFlowIcon(item.entity_type);
                        return (
                          <motion.div
                            key={item.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => {
                              setSelectedItem(item);
                              setDetailSheetOpen(true);
                            }}
                          >
                            <div className="flex items-center gap-4">
                              {/* Priority indicator */}
                              <div
                                className={cn(
                                  "w-2 h-12 rounded-full",
                                  PRIORITY_COLORS[item.priority as keyof typeof PRIORITY_COLORS]
                                )}
                              />

                              {/* Icon */}
                              <div className="p-2 rounded-lg bg-muted">
                                <Icon className="h-5 w-5" />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="capitalize">
                                    {item.entity_type}
                                  </Badge>
                                  <Badge
                                    variant={item.priority === "critical" ? "destructive" : "secondary"}
                                    className="capitalize"
                                  >
                                    {item.priority}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground truncate max-w-md">
                                  {item.flagged_content || "Contenu non disponible"}
                                </p>
                              </div>
                            </div>

                            {/* AI Score */}
                            <div className="flex items-center gap-4">
                              {item.ai_score !== null && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-2">
                                      <Brain className="h-4 w-4 text-purple-500" />
                                      <Progress
                                        value={item.ai_score * 100}
                                        className="w-20 h-2"
                                      />
                                      <span className="text-sm font-medium">
                                        {Math.round(item.ai_score * 100)}%
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Score de confiance IA: {Math.round(item.ai_score * 100)}%
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleModerate(item, "approve");
                                  }}
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleModerate(item, "reject");
                                  }}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rules Tab */}
          <TabsContent value="rules" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  Règles de modération IA
                </CardTitle>
                <CardDescription>
                  Configurez les règles automatiques de modération avec scoring IA
                </CardDescription>
              </CardHeader>
              <CardContent>
                {rules.length === 0 ? (
                  <div className="text-center py-8">
                    <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Aucune règle configurée
                    </p>
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Créer une règle
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule) => {
                      const Icon = getFlowIcon(rule.flow_type);
                      return (
                        <motion.div
                          key={rule.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={cn(
                            "flex items-center justify-between p-4 border rounded-lg transition-colors",
                            rule.is_active ? "bg-background" : "bg-muted/50 opacity-60"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "p-2 rounded-lg",
                              rule.ai_enabled ? "bg-purple-500/10" : "bg-muted"
                            )}>
                              {rule.ai_enabled ? (
                                <Brain className="h-5 w-5 text-purple-500" />
                              ) : (
                                <Icon className="h-5 w-5" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{rule.name}</h3>
                                <Badge variant="outline" className="capitalize">
                                  {rule.flow_type}
                                </Badge>
                                {rule.ai_enabled && (
                                  <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    IA {Math.round(rule.ai_threshold * 100)}%
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {rule.description || "Pas de description"}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span>Déclenchée {rule.total_triggered} fois</span>
                                <span>Précision: {rule.accuracy_rate}%</span>
                                <span className="capitalize">Action: {rule.auto_action}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleRule(rule)}
                                >
                                  {rule.is_active ? (
                                    <Pause className="h-4 w-4" />
                                  ) : (
                                    <Play className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {rule.is_active ? "Désactiver" : "Activer"}
                              </TooltipContent>
                            </Tooltip>
                            <Button variant="outline" size="sm">
                              Modifier
                            </Button>
                            <Button variant="ghost" size="sm" className="text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Rule Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                Nouvelle règle de modération IA
              </DialogTitle>
              <DialogDescription>
                Créez une règle avec scoring IA automatique
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="rule-name">Nom de la règle *</Label>
                <Input
                  id="rule-name"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="Ex: Détection spam profils"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule-description">Description</Label>
                <Textarea
                  id="rule-description"
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  placeholder="Décrivez ce que cette règle détecte..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="flow-type">Type de flux *</Label>
                  <Select
                    value={newRule.flow_type}
                    onValueChange={(value) => setNewRule({ ...newRule, flow_type: value })}
                  >
                    <SelectTrigger id="flow-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FLOW_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auto-action">Action automatique</Label>
                  <Select
                    value={newRule.auto_action}
                    onValueChange={(value) => setNewRule({ ...newRule, auto_action: value })}
                  >
                    <SelectTrigger id="auto-action">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUTO_ACTIONS.map((action) => (
                        <SelectItem key={action.value} value={action.value}>
                          <span className={action.color}>{action.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4 p-4 border rounded-lg bg-purple-500/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-500" />
                    <Label htmlFor="ai-enabled">Activer le scoring IA</Label>
                  </div>
                  <Switch
                    id="ai-enabled"
                    checked={newRule.ai_enabled}
                    onCheckedChange={(checked) => setNewRule({ ...newRule, ai_enabled: checked })}
                  />
                </div>

                {newRule.ai_enabled && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Seuil de confiance IA</Label>
                      <span className="text-sm font-medium">{Math.round(newRule.ai_threshold * 100)}%</span>
                    </div>
                    <Slider
                      value={[newRule.ai_threshold * 100]}
                      onValueChange={([value]) => setNewRule({ ...newRule, ai_threshold: value / 100 })}
                      min={50}
                      max={100}
                      step={5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Les éléments avec un score IA supérieur au seuil déclencheront l'action automatique
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rule-config">Configuration (JSON)</Label>
                <Textarea
                  id="rule-config"
                  value={newRule.rule_config}
                  onChange={(e) => setNewRule({ ...newRule, rule_config: e.target.value })}
                  placeholder='{"keywords": ["spam"], "patterns": ["regex"]}'
                  className="font-mono text-sm"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Priorité</Label>
                  <span className="text-sm font-medium">{newRule.priority}</span>
                </div>
                <Slider
                  value={[newRule.priority]}
                  onValueChange={([value]) => setNewRule({ ...newRule, priority: value })}
                  min={1}
                  max={100}
                  step={1}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleCreateRule}>
                <Sparkles className="h-4 w-4 mr-2" />
                Créer la règle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Detail Sheet */}
        <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
          <SheetContent className="w-full sm:max-w-lg">
            {selectedItem && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      PRIORITY_COLORS[selectedItem.priority as keyof typeof PRIORITY_COLORS]
                    )} />
                    Détail de l'élément
                  </SheetTitle>
                  <SheetDescription>
                    Revue du contenu signalé par l'IA
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* AI Score */}
                  {selectedItem.ai_score !== null && (
                    <div className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Brain className="h-5 w-5 text-purple-500" />
                        <span className="font-medium">Analyse IA</span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm">Score de confiance</span>
                            <span className="font-bold">{Math.round(selectedItem.ai_score * 100)}%</span>
                          </div>
                          <Progress value={selectedItem.ai_score * 100} />
                        </div>
                        {selectedItem.ai_reasoning && (
                          <div>
                            <span className="text-sm text-muted-foreground">Raisonnement IA:</span>
                            <p className="text-sm mt-1">{selectedItem.ai_reasoning}</p>
                          </div>
                        )}
                        {selectedItem.ai_suggested_action && (
                          <div>
                            <span className="text-sm text-muted-foreground">Action suggérée:</span>
                            <Badge variant="outline" className="ml-2 capitalize">
                              {selectedItem.ai_suggested_action}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Content */}
                  <div>
                    <h4 className="font-medium mb-2">Contenu signalé</h4>
                    <div className="p-3 rounded-lg bg-muted text-sm">
                      {selectedItem.flagged_content || "Contenu non disponible"}
                    </div>
                  </div>

                  {/* Matched patterns */}
                  {selectedItem.matched_patterns && selectedItem.matched_patterns.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Patterns détectés</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.matched_patterns.map((pattern, i) => (
                          <Badge key={i} variant="secondary">
                            {pattern}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Type:</span>
                      <Badge variant="outline" className="ml-2 capitalize">
                        {selectedItem.entity_type}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Priorité:</span>
                      <Badge
                        variant={selectedItem.priority === "critical" ? "destructive" : "secondary"}
                        className="ml-2 capitalize"
                      >
                        {selectedItem.priority}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Créé le:</span>
                      <span className="ml-2">
                        {new Date(selectedItem.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Statut:</span>
                      <Badge variant="outline" className="ml-2 capitalize">
                        {selectedItem.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      className="flex-1"
                      variant="outline"
                      onClick={() => handleModerate(selectedItem, "approve")}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Approuver
                    </Button>
                    <Button
                      className="flex-1"
                      variant="destructive"
                      onClick={() => handleModerate(selectedItem, "reject")}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Rejeter
                    </Button>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
