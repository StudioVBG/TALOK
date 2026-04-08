"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus } from "lucide-react";
import { colocationExpensesService } from "@/features/colocation/services/expenses.service";
import { colocationMembersService } from "@/features/colocation/services/members.service";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from "@/features/colocation/types";
import type { ColocationMemberWithDetails, ExpenseCategory, ExpenseSplitType } from "@/features/colocation/types";
import Link from "next/link";

export default function AddExpensePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState<string>("");
  const [currentMemberId, setCurrentMemberId] = useState<string>("");
  const [members, setMembers] = useState<ColocationMemberWithDetails[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    category: "autre" as ExpenseCategory,
    split_type: "equal" as ExpenseSplitType,
    paid_by_member_id: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      const { data: signer } = await supabase
        .from("lease_signers")
        .select("leases!inner(property_id)")
        .eq("profiles.user_id", user.id)
        .in("role", ["locataire_principal", "colocataire"])
        .limit(1)
        .single();

      if (signer) {
        const lease = signer.leases as any;
        if (lease?.property_id) {
          setPropertyId(lease.property_id);

          const membersData = await colocationMembersService.getMembers(lease.property_id);
          setMembers(membersData);

          const myMember = membersData.find((m) => m.tenant_profile_id === profile.id);
          if (myMember) {
            setCurrentMemberId(myMember.id);
            setFormData((prev) => ({ ...prev, paid_by_member_id: myMember.id }));
          }
        }
      }
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;
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
      router.push("/tenant/colocation/expenses");
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'ajout");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <Skeleton className="h-64" />
      </div>
    );
  }

  const activeMembers = members.filter((m) => m.status === "active");

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tenant/colocation/expenses">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Ajouter une depense</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Description *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Categorie</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v as ExpenseCategory })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                  onValueChange={(v) => setFormData({ ...formData, split_type: v as ExpenseSplitType })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                onValueChange={(v) => setFormData({ ...formData, paid_by_member_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selectionner..." /></SelectTrigger>
                <SelectContent>
                  {activeMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.profile?.prenom} {m.profile?.nom}
                      {m.id === currentMemberId ? " (Moi)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={saving}>
              <Plus className="h-4 w-4 mr-2" />
              {saving ? "Ajout..." : "Ajouter la depense"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
