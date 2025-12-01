"use client";
// @ts-nocheck

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ClipboardList,
  Home,
  Calendar,
  User,
  Camera,
  Download,
  Share2,
  Edit,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSignature,
  ChevronDown,
  ChevronRight,
  Image,
  Send,
  Loader2,
  ArrowLeft,
  Printer,
  Mail,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/components/ui/use-toast";

interface Room {
  name: string;
  items: Array<{
    id: string;
    room_name: string;
    item_name: string;
    condition: string | null;
    notes: string | null;
    created_at: string;
    media: Array<{
      id: string;
      storage_path: string;
      media_type: string;
      thumbnail_path: string | null;
      taken_at: string;
    }>;
  }>;
  stats: {
    total: number;
    completed: number;
    bon: number;
    moyen: number;
    mauvais: number;
    tres_mauvais: number;
  };
}

interface InspectionData {
  id: string;
  type: string;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  created_at: string;
  property: {
    id: string;
    adresse_complete: string;
    ville: string;
    code_postal: string;
  };
  tenant: {
    id: string;
    prenom: string | null;
    nom: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
  rooms: Room[];
  signatures: Array<{
    id: string;
    signer_user: string;
    signer_role: string;
    signed_at: string;
    signature_image_path: string | null;
    ip_inet: string | null;
  }>;
  generalMedia: any[];
  stats: {
    totalItems: number;
    completedItems: number;
    totalPhotos: number;
    signaturesCount: number;
  };
}

interface Props {
  data: InspectionData;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-800", icon: Clock },
  in_progress: { label: "En cours", color: "bg-blue-100 text-blue-800", icon: ClipboardList },
  completed: { label: "Terminé", color: "bg-amber-100 text-amber-800", icon: CheckCircle2 },
  signed: { label: "Signé", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  disputed: { label: "Contesté", color: "bg-red-100 text-red-800", icon: AlertCircle },
};

const conditionConfig: Record<string, { label: string; color: string }> = {
  bon: { label: "Bon état", color: "bg-green-100 text-green-800" },
  moyen: { label: "État moyen", color: "bg-yellow-100 text-yellow-800" },
  mauvais: { label: "Mauvais état", color: "bg-orange-100 text-orange-800" },
  tres_mauvais: { label: "Très mauvais", color: "bg-red-100 text-red-800" },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function InspectionDetailClient({ data }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const status = statusConfig[data.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const completionPercentage = data.stats.totalItems > 0
    ? Math.round((data.stats.completedItems / data.stats.totalItems) * 100)
    : 0;

  const ownerSigned = data.signatures.some((s) => s.signer_role === "owner");
  const tenantSigned = data.signatures.some((s) => s.signer_role === "tenant");

  const handleSendToTenant = async () => {
    try {
      setIsSending(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast({
        title: "Invitation envoyée",
        description: "Le locataire a été invité à consulter et signer l'EDL.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer l'invitation",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSign = async () => {
    try {
      const response = await fetch(`/api/edl/${data.id}/sign`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la signature");
      }

      toast({
        title: "EDL signé",
        description: "Votre signature a été enregistrée.",
      });

      router.refresh();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div
      className="p-6 space-y-6 max-w-5xl mx-auto"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link href="/app/owner/inspections">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour aux EDL
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            État des lieux d&apos;{data.type === "entree" ? "entrée" : "sortie"}
            <Badge className={status.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </h1>
          <p className="text-muted-foreground">
            Créé le {new Date(data.created_at).toLocaleDateString("fr-FR")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-1" />
            Imprimer
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
        </div>
      </motion.div>

      {/* Property & Tenant Info */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-blue-50">
                  <Home className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Logement</p>
                  <p className="font-semibold">{data.property.adresse_complete}</p>
                  <p className="text-sm text-muted-foreground">
                    {data.property.code_postal} {data.property.ville}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={data.tenant?.avatar_url || undefined} />
                  <AvatarFallback className="bg-muted">
                    {data.tenant?.prenom?.[0]}
                    {data.tenant?.nom?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm text-muted-foreground">Locataire</p>
                  <p className="font-semibold">
                    {data.tenant
                      ? `${data.tenant.prenom || ""} ${data.tenant.nom || ""}`.trim()
                      : "Non défini"}
                  </p>
                  <p className="text-sm text-muted-foreground">{data.tenant?.email}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Progress & Stats */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Progression</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Éléments inspectés</span>
                  <span className="font-medium">
                    {data.stats.completedItems} / {data.stats.totalItems}
                  </span>
                </div>
                <Progress value={completionPercentage} className="h-3" />
                <p className="text-sm text-muted-foreground">
                  {completionPercentage}% complété
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/app/owner/inspections/${data.id}/photos`)}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-indigo-50">
                  <Camera className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Photos</p>
                  <p className="text-2xl font-bold">{data.stats.totalPhotos}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-xs text-blue-600 mt-2 hover:underline">
                Gérer les photos →
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-50">
                  <FileSignature className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Signatures</p>
                  <p className="text-2xl font-bold">{data.stats.signaturesCount} / 2</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Signatures Status */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileSignature className="h-5 w-5" />
              Signatures
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div
                className={`p-4 rounded-lg border-2 ${
                  ownerSigned ? "border-green-300 bg-green-50" : "border-dashed"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      ownerSigned ? "bg-green-100" : "bg-muted"
                    }`}
                  >
                    {ownerSigned ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Propriétaire</p>
                    <p className="text-sm text-muted-foreground">
                      {ownerSigned ? "Signé" : "En attente"}
                    </p>
                  </div>
                </div>
                {!ownerSigned && data.status !== "draft" && (
                  <Button className="w-full mt-3" onClick={handleSign}>
                    Signer maintenant
                  </Button>
                )}
              </div>

              <div
                className={`p-4 rounded-lg border-2 ${
                  tenantSigned ? "border-green-300 bg-green-50" : "border-dashed"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      tenantSigned ? "bg-green-100" : "bg-muted"
                    }`}
                  >
                    {tenantSigned ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">Locataire</p>
                    <p className="text-sm text-muted-foreground">
                      {tenantSigned ? "Signé" : "En attente"}
                    </p>
                  </div>
                </div>
                {!tenantSigned && data.status !== "draft" && (
                  <Button
                    variant="outline"
                    className="w-full mt-3"
                    onClick={handleSendToTenant}
                    disabled={isSending}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Mail className="h-4 w-4 mr-2" />
                    )}
                    Envoyer une invitation
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Rooms Accordion */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Détail par pièce</CardTitle>
            <CardDescription>
              {data.rooms.length} pièce(s) inspectée(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.rooms.length > 0 ? (
              <Accordion type="multiple" className="space-y-2">
                {data.rooms.map((room, roomIndex) => (
                  <AccordionItem
                    key={roomIndex}
                    value={`room-${roomIndex}`}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <span className="font-semibold">{room.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {room.stats.completed}/{room.stats.total} éléments
                          </Badge>
                          {room.stats.bon > 0 && (
                            <div className="w-3 h-3 rounded-full bg-green-500" title={`${room.stats.bon} en bon état`} />
                          )}
                          {room.stats.moyen > 0 && (
                            <div className="w-3 h-3 rounded-full bg-yellow-500" title={`${room.stats.moyen} en état moyen`} />
                          )}
                          {room.stats.mauvais > 0 && (
                            <div className="w-3 h-3 rounded-full bg-orange-500" title={`${room.stats.mauvais} en mauvais état`} />
                          )}
                          {room.stats.tres_mauvais > 0 && (
                            <div className="w-3 h-3 rounded-full bg-red-500" title={`${room.stats.tres_mauvais} en très mauvais état`} />
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        {room.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between p-3 rounded-lg bg-muted/30"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{item.item_name}</p>
                                {item.condition && (
                                  <Badge className={conditionConfig[item.condition]?.color || ""}>
                                    {conditionConfig[item.condition]?.label || item.condition}
                                  </Badge>
                                )}
                              </div>
                              {item.notes && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                            {item.media.length > 0 && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Image className="h-4 w-4" />
                                <span className="text-sm">{item.media.length}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold">Aucun élément</h3>
                <p className="text-muted-foreground">
                  Aucun élément n&apos;a encore été ajouté à cet EDL
                </p>
                <Button className="mt-4" asChild>
                  <Link href={`/app/owner/inspections/${data.id}/edit`}>
                    <Edit className="h-4 w-4 mr-2" />
                    Compléter l&apos;EDL
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Actions */}
      <motion.div variants={itemVariants}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3">
              {data.status === "draft" && (
                <Button asChild>
                  <Link href={`/app/owner/inspections/${data.id}/edit`}>
                    <Edit className="h-4 w-4 mr-2" />
                    Continuer l&apos;inspection
                  </Link>
                </Button>
              )}
              {(data.status === "draft" || data.status === "in_progress") && (
                <Button asChild variant="default" className="bg-indigo-600 hover:bg-indigo-700">
                  <Link href={`/app/owner/inspections/${data.id}/photos`}>
                    <Camera className="h-4 w-4 mr-2" />
                    Capturer les photos
                  </Link>
                </Button>
              )}
              {data.status === "in_progress" && (
                <Button>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Marquer comme terminé
                </Button>
              )}
              <Button variant="outline">
                <Share2 className="h-4 w-4 mr-2" />
                Partager
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

