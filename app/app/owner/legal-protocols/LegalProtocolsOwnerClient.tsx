"use client";

import { useMemo, useState } from "react";
import { Shield, AlertTriangle, Lock, MapPin, Phone, ExternalLink, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProtocolChecklist } from "@/features/legal/components/protocol-checklist";
import { 
  PROTOCOL_ANTI_SQUAT_OWNER, 
  PROTOCOL_PREVENTION_OWNER 
} from "@/lib/data/legal-protocols";
import {
  getContactsForDepartment,
  getDepartmentFromPostalCode,
  type DepartmentContacts,
} from "@/lib/services/legal-contacts.service";

interface Property {
  id: string;
  adresse_complete: string;
  code_postal: string;
  ville: string;
  departement: string | null;
}

interface LegalProtocolsOwnerClientProps {
  properties: Property[];
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

export function LegalProtocolsOwnerClient({ properties }: LegalProtocolsOwnerClientProps) {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(
    properties.length > 0 ? properties[0].id : null
  );
  
  // Trouver le logement sélectionné
  const selectedProperty = useMemo(() => {
    return properties.find(p => p.id === selectedPropertyId) || null;
  }, [properties, selectedPropertyId]);
  
  // Calculer les contacts géolocalisés basés sur le logement sélectionné
  const localContacts = useMemo<DepartmentContacts | null>(() => {
    if (!selectedProperty?.code_postal) return null;
    const deptCode = getDepartmentFromPostalCode(selectedProperty.code_postal);
    return getContactsForDepartment(deptCode);
  }, [selectedProperty]);

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          Protocoles Juridiques
        </h1>
        <p className="text-muted-foreground">
          Procédures légales pour protéger vos biens et réagir en cas de squat
        </p>
      </div>

      {/* Avertissement important */}
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Rappel fondamental</AlertTitle>
        <AlertDescription>
          En France, il est <strong>strictement interdit</strong> de se faire justice soi-même, 
          même face à un squatteur. Toute expulsion &quot;sauvage&quot; (changement de serrure, coupure des 
          compteurs, etc.) est un <strong>délit puni jusqu&apos;à 3 ans de prison et 30 000 € d&apos;amende</strong>.
          Suivez toujours les procédures légales ci-dessous.
        </AlertDescription>
      </Alert>

      {/* Sélecteur de logement et contacts locaux */}
      {properties.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Contacts pour votre logement
            </CardTitle>
            <CardDescription>
              Sélectionnez un logement pour voir les contacts locaux (préfecture, ADIL, tribunal...)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Sélecteur de logement */}
            <Select
              value={selectedPropertyId || undefined}
              onValueChange={setSelectedPropertyId}
            >
              <SelectTrigger className="w-full mb-4">
                <SelectValue placeholder="Sélectionner un logement" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      <span>{property.adresse_complete}, {property.code_postal} {property.ville}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Contacts locaux */}
            {localContacts && selectedProperty && (
              <>
                <Badge variant="outline" className="mb-4">
                  {localContacts.department_name} ({localContacts.department_code}) - {localContacts.region}
                </Badge>
                
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
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Message si pas de logements */}
      {properties.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Aucun logement</AlertTitle>
          <AlertDescription>
            Ajoutez un logement pour voir les contacts locaux de votre département.
            Les numéros d&apos;urgence nationaux sont : <strong>17</strong> (Police) et <strong>112</strong> (Urgences).
          </AlertDescription>
        </Alert>
      )}

      {/* Onglets des protocoles */}
      <Tabs defaultValue="anti_squat" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="anti_squat" className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            En cas de squat
          </TabsTrigger>
          <TabsTrigger value="prevention" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Prévention
          </TabsTrigger>
        </TabsList>

        <TabsContent value="anti_squat" className="mt-6">
          <ProtocolChecklist 
            protocol={PROTOCOL_ANTI_SQUAT_OWNER}
          />
        </TabsContent>

        <TabsContent value="prevention" className="mt-6">
          <ProtocolChecklist 
            protocol={PROTOCOL_PREVENTION_OWNER}
          />
        </TabsContent>
      </Tabs>

      {/* Footer informatif */}
      <div className="text-center text-sm text-muted-foreground pt-4 border-t">
        <p>
          Ces informations sont fournies à titre indicatif et ne remplacent pas 
          un conseil juridique professionnel. Dernière mise à jour : Janvier 2025.
        </p>
        <p className="mt-1">
          Source : Loi n° 2023-668 du 27 juillet 2023 (Kasbarian-Bergé), Code pénal, Loi DALO.
        </p>
      </div>
    </div>
  );
}







