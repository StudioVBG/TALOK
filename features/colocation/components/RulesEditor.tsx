"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ScrollText } from "lucide-react";
import { colocationRulesService } from "../services/rules.service";
import { RULE_CATEGORIES, RULE_CATEGORY_LABELS } from "../types";
import type { ColocationRuleRow } from "@/lib/supabase/database.types";
import type { RuleCategory } from "../types";

interface RulesEditorProps {
  propertyId: string;
  readOnly?: boolean;
}

export function RulesEditor({ propertyId, readOnly }: RulesEditorProps) {
  const [rules, setRules] = useState<ColocationRuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newRule, setNewRule] = useState({
    title: "",
    category: "general" as RuleCategory,
    description: "",
  });

  useEffect(() => {
    loadRules();
  }, [propertyId]);

  const loadRules = async () => {
    try {
      const data = await colocationRulesService.getRules(propertyId);
      setRules(data);
    } catch (err) {
      console.error("Erreur chargement regles:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newRule.title || !newRule.description) return;
    setSaving(true);
    try {
      await colocationRulesService.createRule({
        property_id: propertyId,
        ...newRule,
        sort_order: rules.length,
      });
      setNewRule({ title: "", category: "general", description: "" });
      setAdding(false);
      await loadRules();
    } catch (err) {
      console.error("Erreur ajout regle:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await colocationRulesService.deleteRule(id);
      await loadRules();
    } catch (err) {
      console.error("Erreur suppression regle:", err);
    }
  };

  // Group rules by category
  const grouped = rules.reduce((acc, rule) => {
    const cat = rule.category as RuleCategory;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(rule);
    return acc;
  }, {} as Record<RuleCategory, ColocationRuleRow[]>);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          Reglement interieur
        </CardTitle>
        {!readOnly && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {rules.length === 0 && !adding ? (
          <p className="text-muted-foreground text-center py-8">
            Aucune regle definie.
          </p>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, categoryRules]) => (
              <div key={category}>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {RULE_CATEGORY_LABELS[category as RuleCategory]}
                </h4>
                <div className="space-y-2">
                  {categoryRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{rule.title}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {rule.description}
                        </p>
                      </div>
                      {!readOnly && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {adding && (
          <div className="mt-4 p-4 rounded-lg border-2 border-dashed space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Titre de la regle"
                value={newRule.title}
                onChange={(e) =>
                  setNewRule({ ...newRule, title: e.target.value })
                }
              />
              <Select
                value={newRule.category}
                onValueChange={(v) =>
                  setNewRule({ ...newRule, category: v as RuleCategory })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {RULE_CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder="Description de la regle..."
              value={newRule.description}
              onChange={(e) =>
                setNewRule({ ...newRule, description: e.target.value })
              }
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdding(false)}
              >
                Annuler
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={saving}>
                {saving ? "..." : "Ajouter"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
