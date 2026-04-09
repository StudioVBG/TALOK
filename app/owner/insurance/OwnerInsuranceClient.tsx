"use client";

import { useState } from "react";
import { Shield, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InsuranceCard } from "@/features/insurance/components/insurance-card";
import { InsuranceForm } from "@/features/insurance/components/insurance-form";
import { InsuranceReminder } from "@/features/insurance/components/insurance-reminder";
import {
  useInsurancePolicies,
  useCreateInsurance,
  useUpdateInsurance,
  useDeleteInsurance,
} from "@/lib/hooks/use-insurance";
import type { InsurancePolicyInsert, InsurancePolicyWithExpiry } from "@/lib/insurance/types";
import { Loader2 } from "lucide-react";

interface OwnerInsuranceClientProps {
  profileId: string;
  properties: { id: string; adresse_complete: string }[];
}

export function OwnerInsuranceClient({ profileId, properties }: OwnerInsuranceClientProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicyWithExpiry | null>(null);

  const { data: policies = [], isLoading } = useInsurancePolicies();
  const createMutation = useCreateInsurance();
  const updateMutation = useUpdateInsurance();
  const deleteMutation = useDeleteInsurance();

  async function handleCreate(data: InsurancePolicyInsert) {
    await createMutation.mutateAsync(data);
    setShowForm(false);
  }

  async function handleUpdate(data: InsurancePolicyInsert) {
    if (!editingPolicy) return;
    await updateMutation.mutateAsync({
      id: editingPolicy.id,
      data: {
        insurance_type: data.insurance_type,
        insurer_name: data.insurer_name,
        policy_number: data.policy_number,
        start_date: data.start_date,
        end_date: data.end_date,
        amount_covered_cents: data.amount_covered_cents,
        property_id: data.property_id,
      },
    });
    setEditingPolicy(null);
  }

  function handleEdit(policy: InsurancePolicyWithExpiry) {
    setEditingPolicy(policy);
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette assurance ?")) return;
    await deleteMutation.mutateAsync(id);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
            <Shield className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mes assurances</h1>
            <p className="text-sm text-muted-foreground">
              Gerez vos polices d&apos;assurance et suivez les echeances
            </p>
          </div>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {/* Alertes */}
      <InsuranceReminder policies={policies} />

      {/* Liste des assurances */}
      {policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Shield className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">Aucune assurance</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Ajoutez vos polices d&apos;assurance pour suivre les echeances et recevoir des rappels.
          </p>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter une assurance
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {policies.map((policy: InsurancePolicyWithExpiry) => (
            <InsuranceCard
              key={policy.id}
              policy={policy}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Dialog ajout */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter une assurance</DialogTitle>
          </DialogHeader>
          <InsuranceForm
            profileId={profileId}
            properties={properties}
            onSubmit={handleCreate}
            isLoading={createMutation.isPending}
            onCancel={() => setShowForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog modification */}
      <Dialog open={!!editingPolicy} onOpenChange={(open: boolean) => !open && setEditingPolicy(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier l&apos;assurance</DialogTitle>
          </DialogHeader>
          {editingPolicy && (
            <InsuranceForm
              profileId={profileId}
              properties={properties}
              initialData={editingPolicy}
              onSubmit={handleUpdate}
              isLoading={updateMutation.isPending}
              onCancel={() => setEditingPolicy(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
