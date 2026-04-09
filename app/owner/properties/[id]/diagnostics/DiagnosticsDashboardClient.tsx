"use client";

import { DiagnosticsList } from "@/features/diagnostics/components/DiagnosticsList";
import { RequiredDiagnosticsChecker } from "@/features/diagnostics/components/RequiredDiagnosticsChecker";

interface DiagnosticsDashboardClientProps {
  propertyId: string;
}

export function DiagnosticsDashboardClient({ propertyId }: DiagnosticsDashboardClientProps) {
  return (
    <div className="space-y-8">
      <RequiredDiagnosticsChecker propertyId={propertyId} />
      <DiagnosticsList propertyId={propertyId} />
    </div>
  );
}
