"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import type {
  PropertyDiagnostic,
  DiagnosticType,
  RequiredDiagnostic,
} from "@/lib/validations/diagnostics";
import { DiagnosticCard, DiagnosticPlaceholderCard } from "./DiagnosticCard";
import { DiagnosticFormDialog } from "./DiagnosticFormDialog";

interface DiagnosticsListProps {
  propertyId: string;
}

interface ChecklistItem extends RequiredDiagnostic {
  status: "missing" | "valid" | "expired";
  performed_date: string | null;
  expiry_date: string | null;
}

export function DiagnosticsList({ propertyId }: DiagnosticsListProps) {
  const [diagnostics, setDiagnostics] = useState<PropertyDiagnostic[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDiag, setEditingDiag] = useState<PropertyDiagnostic | null>(null);
  const [addingType, setAddingType] = useState<DiagnosticType | undefined>();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [diagRes, checkRes] = await Promise.all([
        fetch(`/api/diagnostics?property_id=${propertyId}`),
        fetch("/api/diagnostics/check-required", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ property_id: propertyId }),
        }),
      ]);

      if (diagRes.ok) {
        const diagData = await diagRes.json();
        setDiagnostics(diagData.diagnostics ?? []);
      }

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        setChecklist(checkData.checklist ?? []);
      }
    } catch (err) {
      console.error("Error loading diagnostics:", err);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleEdit(diag: PropertyDiagnostic) {
    setEditingDiag(diag);
    setAddingType(undefined);
    setDialogOpen(true);
  }

  function handleAdd(type?: DiagnosticType) {
    setEditingDiag(null);
    setAddingType(type);
    setDialogOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Build a map of existing diagnostics by type
  const existingByType = new Map(
    diagnostics.map((d) => [d.diagnostic_type, d])
  );

  // Split checklist into existing (have a diagnostic) and missing
  const existingItems = checklist.filter(
    (c) => existingByType.has(c.type)
  );
  const missingRequired = checklist.filter(
    (c) => !existingByType.has(c.type) && c.required
  );
  const missingOptional = checklist.filter(
    (c) => !existingByType.has(c.type) && !c.required
  );

  return (
    <div className="space-y-6">
      {/* Existing diagnostics */}
      {existingItems.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Diagnostics enregistrés ({existingItems.length})
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {existingItems.map((item) => {
              const diag = existingByType.get(item.type)!;
              return (
                <DiagnosticCard
                  key={diag.id}
                  diagnostic={diag}
                  onEdit={handleEdit}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Missing required diagnostics */}
      {missingRequired.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-amber-700 uppercase tracking-wide">
            Diagnostics requis manquants ({missingRequired.length})
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {missingRequired.map((item) => (
              <DiagnosticPlaceholderCard
                key={item.type}
                type={item.type}
                required
                reason={item.reason}
                onAdd={() => handleAdd(item.type)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Optional diagnostics */}
      {missingOptional.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Autres diagnostics
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {missingOptional.map((item) => (
              <DiagnosticPlaceholderCard
                key={item.type}
                type={item.type}
                required={false}
                reason={item.reason}
                onAdd={() => handleAdd(item.type)}
              />
            ))}
          </div>
        </div>
      )}

      <DiagnosticFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        propertyId={propertyId}
        diagnostic={editingDiag}
        preselectedType={addingType}
        onSaved={fetchData}
      />
    </div>
  );
}
