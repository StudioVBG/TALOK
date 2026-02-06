import { Wrench } from "lucide-react";
import { ResourceNotFound } from "@/components/ui/resource-not-found";

export default function ProviderNotFound() {
  return (
    <ResourceNotFound
      icon={Wrench}
      title="Prestataire introuvable"
      description="Ce prestataire n'existe pas ou a été supprimé. Vérifiez l'URL ou retournez à la liste."
      backHref="/owner/providers"
      backLabel="Retour aux prestataires"
    />
  );
}
