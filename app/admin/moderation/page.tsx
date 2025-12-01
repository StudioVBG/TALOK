"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/hooks/use-auth";
import { Plus, Shield, AlertTriangle, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ModerationRule {
  id: string;
  flow_type: string;
  rule_config: any;
  is_active: boolean;
  created_at: string;
}

export default function AdminModerationPage() {
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();
  const [rules, setRules] = useState<ModerationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    flow_type: "",
    rule_config: "",
    is_active: true,
  });

  useEffect(() => {
    if (authLoading) return;
    
    if (!user || profile?.role !== "admin") {
      return;
    }

    fetchRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, authLoading]);

  async function fetchRules() {
    setLoading(true);
    try {
      // TODO: Créer une route API GET /api/admin/moderation/rules
      // Pour l'instant, on simule avec un tableau vide
      setRules([]);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de charger les règles",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRule() {
    if (!newRule.flow_type || !newRule.rule_config) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs",
        variant: "destructive",
      });
      return;
    }

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

      const response = await fetch("/api/admin/moderation/rules", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          flow_type: newRule.flow_type,
          rule_config: JSON.parse(newRule.rule_config),
          is_active: newRule.is_active,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la création");
      }

      toast({
        title: "Règle créée",
        description: "La règle de modération a été créée avec succès.",
      });

      setCreateDialogOpen(false);
      setNewRule({ flow_type: "", rule_config: "", is_active: true });
      fetchRules();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la règle",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Modération</h1>
          <p className="text-muted-foreground mt-2">
            Gérez les règles de modération et les politiques de contenu
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle règle
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Règles de modération</CardTitle>
          <CardDescription>
            Configurez les règles automatiques de modération
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Chargement...</p>
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">Aucune règle configurée</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Créer une règle
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <h3 className="font-semibold">{rule.flow_type}</h3>
                    <p className="text-sm text-muted-foreground">
                      {JSON.stringify(rule.rule_config)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Créé le {new Date(rule.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {rule.is_active ? (
                      <span className="text-sm text-green-600">Actif</span>
                    ) : (
                      <span className="text-sm text-gray-400">Inactif</span>
                    )}
                    <Button variant="outline" size="sm">
                      Modifier
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de création */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle règle de modération</DialogTitle>
            <DialogDescription>
              Créez une nouvelle règle de modération automatique
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="flow_type">Type de flux *</Label>
              <Select
                value={newRule.flow_type}
                onValueChange={(value) => setNewRule({ ...newRule, flow_type: value })}
              >
                <SelectTrigger id="flow_type" className="mt-2">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profile">Profil</SelectItem>
                  <SelectItem value="message">Message</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="listing">Annonce</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rule_config">Configuration (JSON) *</Label>
              <Textarea
                id="rule_config"
                value={newRule.rule_config}
                onChange={(e) => setNewRule({ ...newRule, rule_config: e.target.value })}
                placeholder='{"condition": "...", "action": "..."}'
                className="mt-2 font-mono text-sm"
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateRule}>
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

