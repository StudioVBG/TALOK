"use client";
// @ts-nocheck

import { useState } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HelpCircle, MessageSquare, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { RestartTourCard } from "@/components/onboarding/RestartTourCard";

const SERVICES = [
  {
    id: "edl_pro",
    label: "EDL professionnel",
    description: "Réalisation d'un état des lieux par un professionnel",
  },
  {
    id: "gestion_impaye",
    label: "Gestion impayé complexe",
    description: "Accompagnement pour la gestion d'un impayé complexe",
  },
  {
    id: "assistance_bail_commercial",
    label: "Assistance bail commercial",
    description: "Conseil et assistance pour les baux commerciaux",
  },
  {
    id: "eidas_avance",
    label: "eIDAS avancé",
    description: "Signature électronique avancée avec eIDAS",
  },
  {
    id: "gli",
    label: "Garantie loyers impayés (GLI)",
    description: "Souscription à une garantie loyers impayés",
  },
];

export default function OwnerSupportPage() {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [requestHistory] = useState<any[]>([]);

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <div className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header avec animation */}
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">
              Aide & services
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Vous n'êtes pas seul - nous sommes là pour vous aider
            </p>
          </div>

          {/* Carte principale */}
          <Card className="mb-8 border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                Vous n'êtes pas seul
              </CardTitle>
              <CardDescription>
                Notre équipe est disponible pour vous accompagner dans la gestion de votre
                portefeuille locatif
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Que vous ayez besoin d'aide pour un EDL, la gestion d'un impayé, ou toute autre
                question, nous sommes là pour vous.
              </p>
            </CardContent>
          </Card>

          {/* Tour guidé */}
          <div className="mb-8">
            <RestartTourCard />
          </div>

          {/* Catalogue de services */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Services disponibles</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {SERVICES.map((service, index) => (
                <Card
                  key={service.id}
                  className={cn(
                    "cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] group",
                    "animate-in fade-in slide-in-from-bottom-4"
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                  onClick={() => setSelectedService(service.id)}
                >
                  <CardHeader>
                    <CardTitle className="text-base">{service.label}</CardTitle>
                    <CardDescription className="text-sm">
                      {service.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full">
                      Demander ce service
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Formulaire de demande */}
          {selectedService && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>
                  Demande de service :{" "}
                  {SERVICES.find((s) => s.id === selectedService)?.label}
                </CardTitle>
                <CardDescription>
                  Remplissez le formulaire ci-dessous pour faire une demande
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Sujet</label>
                  <Input placeholder="Sujet de votre demande" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <Textarea
                    placeholder="Décrivez votre besoin en détail..."
                    rows={5}
                  />
                </div>
                <div className="flex gap-2">
                  <Button>Envoyer la demande</Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedService(null)}
                  >
                    Annuler
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Historique des demandes */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Historique des demandes</h2>
            {requestHistory.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Aucune demande pour le moment
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {requestHistory.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium">{request.subject}</h3>
                            <Badge
                              variant={
                                request.status === "completed"
                                  ? "default"
                                  : request.status === "in_progress"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {request.status === "completed"
                                ? "Terminé"
                                : request.status === "in_progress"
                                ? "En cours"
                                : "Ouvert"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {request.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Créé le {new Date(request.created_at).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
