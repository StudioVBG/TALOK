"use client";
import { useEffect, useState } from "react";
import { PlanGate } from "@/components/subscription/plan-gate";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useEntityStore } from "@/stores/useEntityStore";
import Link from "next/link";
import { ArrowLeft, UserPlus, X, Shield, Save } from "lucide-react";

type EcAccessItem = {
  id: string;
  ec_name: string;
  ec_email: string;
  ec_phone: string | null;
  access_level: string;
  granted_at: string;
  auto_send_on_closing: boolean;
  read_only_access: boolean;
};

type EcAccessResponse = EcAccessItem[] | { data?: EcAccessItem[] };

export default function ECManageClient() {
  return (
    <PlanGate feature="bank_reconciliation" mode="block">
      <ECManageContent />
    </PlanGate>
  );
}

function ECManageContent() {
  const { activeEntityId } = useEntityStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    ecEmail: "",
    ecFirmName: "",
    accessLevel: "read",
  });

  const { data, isLoading } = useQuery<EcAccessResponse>({
    queryKey: ["ec-access", activeEntityId],
    queryFn: () =>
      apiClient.get<EcAccessResponse>(
        `/accounting/ec/access?entityId=${activeEntityId}`,
      ),
    enabled: !!activeEntityId,
  });

  const inviteMutation = useMutation<unknown, unknown, Record<string, unknown>>({
    mutationFn: (body) => apiClient.post("/accounting/ec/access", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ec-access"] });
      setShowForm(false);
    },
  });

  const revokeMutation = useMutation<unknown, unknown, string>({
    mutationFn: (id) => apiClient.delete(`/accounting/ec/access/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ec-access"] }),
  });

  const ecList: EcAccessItem[] = Array.isArray(data)
    ? data
    : (data?.data ?? []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/owner/accounting"
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Expert-comptable</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          Inviter
        </button>
      </div>

      {showForm && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <input
            placeholder="Email de l'expert-comptable"
            value={form.ecEmail}
            onChange={(e) => setForm({ ...form, ecEmail: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="Nom du cabinet"
            value={form.ecFirmName}
            onChange={(e) => setForm({ ...form, ecFirmName: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <select
            value={form.accessLevel}
            onChange={(e) => setForm({ ...form, accessLevel: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="read">Lecture seule</option>
            <option value="annotate">Lecture + annotations</option>
            <option value="validate">Validation</option>
          </select>
          <button
            onClick={() =>
              inviteMutation.mutate({ ...form, entityId: activeEntityId })
            }
            disabled={inviteMutation.isPending}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium w-full"
          >
            {inviteMutation.isPending ? "Envoi..." : "Envoyer l'invitation"}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
      ) : ecList.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Aucun expert-comptable connecte</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Invitez votre EC pour partager vos donnees comptables en toute securite.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {ecList.map((ec) => (
            <ECCard
              key={ec.id}
              ec={ec}
              onRevoke={() => revokeMutation.mutate(ec.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EC row with inline edit ──────────────────────────────────────────────

function ECCard({
  ec,
  onRevoke,
}: {
  ec: EcAccessItem;
  onRevoke: () => void;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({
    ec_name: ec.ec_name ?? "",
    ec_email: ec.ec_email ?? "",
    ec_phone: ec.ec_phone ?? "",
    auto_send_on_closing: !!ec.auto_send_on_closing,
    read_only_access: ec.read_only_access !== false,
  });

  // Keep local state in sync when React Query returns fresh data.
  useEffect(() => {
    setDraft({
      ec_name: ec.ec_name ?? "",
      ec_email: ec.ec_email ?? "",
      ec_phone: ec.ec_phone ?? "",
      auto_send_on_closing: !!ec.auto_send_on_closing,
      read_only_access: ec.read_only_access !== false,
    });
  }, [ec.id, ec.ec_name, ec.ec_email, ec.ec_phone, ec.auto_send_on_closing, ec.read_only_access]);

  const saveMutation = useMutation<unknown, unknown, Record<string, unknown>>({
    mutationFn: (body) =>
      apiClient.patch(`/accounting/ec/access/${ec.id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ec-access"] }),
  });

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{ec.ec_name}</p>
          <p className="text-xs text-muted-foreground">
            Invite le {new Date(ec.granted_at).toLocaleDateString("fr-FR")}
            {" · "}niveau {ec.access_level}
          </p>
        </div>
        <button
          type="button"
          onClick={onRevoke}
          aria-label={`Révoquer l'accès de ${ec.ec_name ?? ec.ec_email}`}
          className="text-destructive hover:text-destructive/80"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="text-xs text-muted-foreground flex flex-col gap-1">
          Nom / cabinet
          <input
            value={draft.ec_name}
            onChange={(e) => setDraft({ ...draft, ec_name: e.target.value })}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground flex flex-col gap-1">
          Email
          <input
            type="email"
            value={draft.ec_email}
            onChange={(e) => setDraft({ ...draft, ec_email: e.target.value })}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted-foreground flex flex-col gap-1">
          Telephone
          <input
            type="tel"
            value={draft.ec_phone}
            onChange={(e) => setDraft({ ...draft, ec_phone: e.target.value })}
            placeholder="+33 1 23 45 67 89"
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={draft.auto_send_on_closing}
            onChange={(e) =>
              setDraft({ ...draft, auto_send_on_closing: e.target.checked })
            }
          />
          Envoyer automatiquement le pack a la cloture annuelle
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={draft.read_only_access}
            onChange={(e) =>
              setDraft({ ...draft, read_only_access: e.target.checked })
            }
          />
          Acces en lecture seule
        </label>
      </div>

      <div className="flex items-center justify-end gap-2">
        {saveMutation.isSuccess && (
          <span className="text-xs text-emerald-500">Enregistre.</span>
        )}
        {saveMutation.isError && (
          <span className="text-xs text-red-500">Erreur lors de l&apos;enregistrement.</span>
        )}
        <button
          type="button"
          onClick={() => saveMutation.mutate(draft)}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
