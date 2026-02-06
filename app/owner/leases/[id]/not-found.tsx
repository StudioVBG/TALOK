import { FileText } from "lucide-react";
import { ResourceNotFound } from "@/components/ui/resource-not-found";

export default function LeaseNotFound() {
  return (
    <ResourceNotFound
      icon={FileText}
      title="Bail introuvable"
      description="Ce bail n'existe pas ou a été supprimé. Vérifiez l'URL ou retournez à la liste des baux."
      backHref="/owner/leases"
      backLabel="Retour aux baux"
    />
  );
}
