"use client";

import { useState } from "react";
import { Shield, Plus, Upload } from "lucide-react";
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
import Link from "next/link";

interface TenantInsuranceClientProps {
  profileId: string;
}

export function TenantInsuranceClient({ profileId }: TenantInsuranceClientProps) {
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
            <h1 className="text-2xl font-bold">Mon assurance</h1>
            <p className="text-sm text-muted-foreground">
              Votre assurance multirisques habitation est obligatoire
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild className="gap-2">
            <Link href="/tenant/documents?action=upload&type=attestation_assurance">
              <Upload className="h-4 w-4" />
              Deposer attestation
            </Link>
          </Button>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Alertes */}
      <InsuranceReminder policies={policies} />

      {/* Info obligatoire */}
      {policies.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                Assurance habitation obligatoire
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                En tant que locataire, vous devez fournir une attestation d&apos;assurance
                multirisques habitation chaque annee a votre proprietaire.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Liste des assurances */}
      {policies.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Shield className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold">Aucune assurance enregistree</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Ajoutez votre assurance habitation pour faciliter le suivi avec votre proprietaire.
          </p>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Ajouter mon assurance
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
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
            <DialogTitle>Ajouter mon assurance</DialogTitle>
          </DialogHeader>
          <InsuranceForm
            profileId={profileId}
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
