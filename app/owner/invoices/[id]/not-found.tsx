import { CreditCard } from "lucide-react";
import { ResourceNotFound } from "@/components/ui/resource-not-found";

export default function InvoiceNotFound() {
  return (
    <ResourceNotFound
      icon={CreditCard}
      title="Facture introuvable"
      description="Cette facture n'existe pas ou a été supprimée. Vérifiez l'URL ou retournez aux finances."
      backHref="/owner/money"
      backLabel="Retour aux finances"
    />
  );
}
