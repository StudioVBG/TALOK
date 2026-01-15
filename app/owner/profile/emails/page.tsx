"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { EmailTemplatesViewer } from "@/components/emails/email-templates-viewer";
import { EMAIL_TEMPLATES_DATA } from "@/lib/emails/templates-data";

// Filtrer les templates pertinents pour les propriétaires
const OWNER_RELEVANT_CATEGORIES = [
  "onboarding",
  "payment",
  "lease",
  "maintenance",
  "visit",
  "notification",
  "legal",
  "account",
];

export default function OwnerEmailsPage() {
  // Les propriétaires peuvent voir tous les templates pour comprendre
  // les communications avec leurs locataires
  const relevantTemplates = EMAIL_TEMPLATES_DATA.filter((template) =>
    OWNER_RELEVANT_CATEGORIES.includes(template.category)
  );

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <div className="h-[calc(100vh-120px)]">
        <EmailTemplatesViewer
          templates={relevantTemplates}
          title="Aperçu des Emails"
          showFilters={true}
          className="h-full"
        />
      </div>
    </ProtectedRoute>
  );
}
