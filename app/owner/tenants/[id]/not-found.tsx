import { User } from "lucide-react";
import { ResourceNotFound } from "@/components/ui/resource-not-found";

export default function TenantNotFound() {
  return (
    <ResourceNotFound
      icon={User}
      title="Locataire introuvable"
      description="Ce locataire n'existe pas ou a été supprimé. Vérifiez l'URL ou retournez à la liste."
      backHref="/owner/tenants"
      backLabel="Retour aux locataires"
    />
  );
}
