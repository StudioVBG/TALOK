"use client";

import { useMemo } from "react";
import { Shield, MapPin, Phone, ExternalLink, AlertTriangle, Building2, Home } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  getContactsForDepartment, 
  getDepartmentFromPostalCode,
  type DepartmentContacts 
} from "@/lib/services/legal-contacts.service";
import { ProtocolChecklist } from "@/features/legal/components/protocol-checklist";
import { PROTOCOL_PROTECTION_TENANT } from "@/lib/data/legal-protocols";

interface PropertyAddress {
  adresse_complete: string;
  code_postal: string;
  ville: string;
  departement: string | null;
}

interface LegalRightsClientProps {
  propertyAddress: PropertyAddress | null;
}

// Composant de carte de contact
function ContactCard({ 
  contact, 
  variant 
}: { 
  contact: { 
    role: string; 
    name: string; 
    address?: string; 
    phone?: string; 
    url?: string; 
    notes: string;
    opening_hours?: string;
  };
  variant: "important" | "help" | "neutral" | "emergency";
}) {
  const variants = {
    important: "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20",
    help: "border-green-300 bg-green-50/50 dark:bg-green-950/20",
    neutral: "border-slate-200",
    emergency: "border-red-300 bg-red-50/50 dark:bg-red-950/20"
  };

  return (
    <Card className={variants[variant]}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Badge variant="outline" className="mb-2 text-xs">
              {contact.role}
            </Badge>
            <p className="font-semibold text-sm truncate">{contact.name}</p>
            {contact.address && (
              <p className="text-xs text-muted-foreground truncate">{contact.address}</p>
            )}
            {contact.opening_hours && (
              <p className="text-xs text-muted-foreground">{contact.opening_hours}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">{contact.notes}</p>
          </div>
          <div className="flex flex-col gap-1">
            {contact.phone && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => window.location.href = `tel:${contact.phone}`}
              >
                <Phone className="w-4 h-4" />
              </Button>
            )}
            {contact.url && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => window.open(contact.url, "_blank")}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function LegalRightsClient({ propertyAddress }: LegalRightsClientProps) {
  // Calculer les contacts géolocalisés basés sur le code postal du logement
  const localContacts = useMemo<DepartmentContacts | null>(() => {
    if (!propertyAddress?.code_postal) return null;
    const deptCode = getDepartmentFromPostalCode(propertyAddress.code_postal);
    return getContactsForDepartment(deptCode);
  }, [propertyAddress]);

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          Vos Droits de Locataire
        </h1>
        <p className="text-muted-foreground">
          Protocoles de protection et contacts utiles pour votre logement
        </p>
      </div>

      {/* Adresse du logement et contacts locaux */}
      {propertyAddress && localContacts && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Contacts pour votre logement
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {propertyAddress.adresse_complete}, {propertyAddress.code_postal} {propertyAddress.ville}
            </CardDescription>
            <Badge variant="outline" className="w-fit mt-1">
              {localContacts.department_name} ({localContacts.department_code}) - {localContacts.region}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Préfecture */}
              <ContactCard contact={localContacts.prefecture} variant="important" />
              
              {/* ADIL */}
              {localContacts.adil && (
                <ContactCard contact={localContacts.adil} variant="help" />
              )}
              
              {/* Tribunal */}
              <ContactCard contact={localContacts.tribunal_judiciaire} variant="neutral" />
              
              {/* Commissariat */}
              <ContactCard contact={localContacts.commissariat_principal} variant="emergency" />
            </div>

            {/* Contacts d'urgence */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-semibold mb-2 text-red-600 flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Numéros d&apos;urgence
              </p>
              <div className="flex flex-wrap gap-2">
                {localContacts.emergency_contacts.map((contact, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="border-red-300 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30"
                    onClick={() => {
                      if (contact.phone) {
                        window.location.href = `tel:${contact.phone}`;
                      } else if (contact.url) {
                        window.open(contact.url, "_blank");
                      }
                    }}
                  >
                    {contact.phone ? (
                      <>
                        <Phone className="w-3.5 h-3.5 mr-1.5" />
                        {contact.phone} - {contact.name}
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                        {contact.name}
                      </>
                    )}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerte sans logement */}
      {!propertyAddress && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Aucun logement associé</AlertTitle>
          <AlertDescription>
            Nous ne pouvons pas afficher les contacts locaux car vous n&apos;avez pas encore de bail actif.
            Les numéros d&apos;urgence nationaux restent disponibles : <strong>17</strong> (Police) et <strong>115</strong> (SAMU Social).
          </AlertDescription>
        </Alert>
      )}

      {/* Message rassurant */}
      <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
        <Home className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-700 dark:text-green-400">
          Vous êtes protégé(e) par la loi
        </AlertTitle>
        <AlertDescription className="text-green-600 dark:text-green-300">
          En tant que locataire avec un bail valide, vous avez un <strong>droit au domicile</strong> protégé 
          par le Code pénal. Personne — même votre propriétaire — ne peut vous expulser sans décision de justice.
        </AlertDescription>
      </Alert>

      {/* Avertissement important */}
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Si votre propriétaire vous expulse illégalement</AlertTitle>
        <AlertDescription>
          Changer votre serrure, couper l&apos;eau/électricité ou jeter vos affaires sans jugement est un{" "}
          <strong>délit pénal</strong> (3 ans de prison, 30 000 € d&apos;amende). 
          Appelez immédiatement le <strong>17</strong> et suivez le protocole ci-dessous.
        </AlertDescription>
      </Alert>

      <Separator />

      {/* Protocole complet */}
      <ProtocolChecklist 
        protocol={PROTOCOL_PROTECTION_TENANT}
      />

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground pt-4 border-t">
        <p>
          Ces informations sont à titre indicatif et ne remplacent pas un conseil juridique professionnel.
        </p>
        <p className="mt-1">
          En cas de doute, contactez l&apos;ADIL 
          {localContacts?.department_name && ` de ${localContacts.department_name}`} (gratuit) ou le{" "}
          <a 
            href="https://www.anil.org/lanil-et-les-adil/votre-adil/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            site de l&apos;ANIL
          </a>.
        </p>
      </div>
    </div>
  );
}







