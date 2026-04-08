"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { colocationExpensesService } from "../services/expenses.service";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, EXPENSE_SPLIT_TYPES } from "../types";
import type { ColocationMemberWithDetails, ExpenseCategory, ExpenseSplitType } from "../types";

interface ExpenseFormProps {
  propertyId: string;
  members: ColocationMemberWithDetails[];
  currentMemberId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ExpenseForm({
  propertyId,
  members,
  currentMemberId,
  open,
  onOpenChange,
  onSaved,
}: ExpenseFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    category: "autre" as ExpenseCategory,
    split_type: "equal" as ExpenseSplitType,
    paid_by_member_id: currentMemberId || "",
    date: new Date().toISOString().split("T")[0],
  });

  const activeMembers = members.filter((m) => m.status === "active");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await colocationExpensesService.createExpense({
        property_id: propertyId,
        paid_by_member_id: formData.paid_by_member_id,
        title: formData.title,
        amount_cents: Math.round(parseFloat(formData.amount) * 100),
        category: formData.category,
        split_type: formData.split_type,
        date: formData.date,
      });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'ajout");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une depense</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Description *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Courses menage, Internet..."
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="amount">Montant (€) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                required
              />
            </div>
            <div>
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Categorie</Label>
              <Select
                value={formData.category}
                onValueChange={(v) =>
                  setFormData({ ...formData, category: v as ExpenseCategory })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {EXPENSE_CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Repartition</Label>
              <Select
                value={formData.split_type}
                onValueChange={(v) =>
                  setFormData({ ...formData, split_type: v as ExpenseSplitType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">Egal</SelectItem>
                  <SelectItem value="by_room">Par chambre</SelectItem>
                  <SelectItem value="custom">Personnalise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Paye par</Label>
            <Select
              value={formData.paid_by_member_id}
              onValueChange={(v) =>
                setFormData({ ...formData, paid_by_member_id: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selectionner..." />
              </SelectTrigger>
              <SelectContent>
                {activeMembers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.profile?.prenom} {m.profile?.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Ajout..." : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
