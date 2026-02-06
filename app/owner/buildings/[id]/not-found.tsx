import { Building2 } from "lucide-react";
import { ResourceNotFound } from "@/components/ui/resource-not-found";

export default function BuildingNotFound() {
  return (
    <ResourceNotFound
      icon={Building2}
      title="Immeuble introuvable"
      description="Cet immeuble n'existe pas ou a été supprimé. Vérifiez l'URL ou retournez à la liste."
      backHref="/owner/buildings"
      backLabel="Retour aux immeubles"
    />
  );
}
