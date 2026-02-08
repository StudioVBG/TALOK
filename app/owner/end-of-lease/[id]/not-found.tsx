import { CalendarClock } from "lucide-react";
import { ResourceNotFound } from "@/components/ui/resource-not-found";

export default function EndOfLeaseNotFound() {
  return (
    <ResourceNotFound
      icon={CalendarClock}
      title="Fin de bail introuvable"
      description="Cette procédure de fin de bail n'existe pas ou a été supprimée. Vérifiez l'URL ou retournez à la liste."
      backHref="/owner/end-of-lease"
      backLabel="Retour aux fins de bail"
    />
  );
}
