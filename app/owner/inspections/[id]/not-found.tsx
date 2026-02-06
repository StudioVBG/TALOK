import { ClipboardCheck } from "lucide-react";
import { ResourceNotFound } from "@/components/ui/resource-not-found";

export default function InspectionNotFound() {
  return (
    <ResourceNotFound
      icon={ClipboardCheck}
      title="État des lieux introuvable"
      description="Cet état des lieux n'existe pas ou a été supprimé. Vérifiez l'URL ou retournez à la liste."
      backHref="/owner/inspections"
      backLabel="Retour aux états des lieux"
    />
  );
}
