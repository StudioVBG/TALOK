import { Wrench } from "lucide-react";
import { ResourceNotFound } from "@/components/ui/resource-not-found";

export default function TicketNotFound() {
  return (
    <ResourceNotFound
      icon={Wrench}
      title="Ticket introuvable"
      description="Ce ticket n'existe pas ou a été supprimé. Vérifiez l'URL ou retournez à la liste des tickets."
      backHref="/owner/tickets"
      backLabel="Retour aux tickets"
    />
  );
}
