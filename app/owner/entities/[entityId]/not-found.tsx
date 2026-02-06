import { Building2 } from "lucide-react";
import { ResourceNotFound } from "@/components/ui/resource-not-found";

export default function EntityNotFound() {
  return (
    <ResourceNotFound
      icon={Building2}
      title="Entité introuvable"
      description="Cette entité juridique n'existe pas ou a été supprimée. Vérifiez l'URL ou retournez à la liste des entités."
      backHref="/owner/entities"
      backLabel="Retour aux entités"
    />
  );
}
