"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Euro, 
  ClipboardList, 
  ScrollText,
  Home,
  Mail,
  Phone,
  CheckCircle2,
  Clock
} from "lucide-react";
import { ColocExpenseSplit } from "@/features/tenant/components/coloc-expense-split";
import { ColocChores } from "@/features/tenant/components/coloc-chores";
import { ColocHouseRules } from "@/features/tenant/components/coloc-house-rules";
import { ColocBoard } from "@/features/tenant/components/coloc-board";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { logger } from "@/lib/monitoring";

interface Roommate {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  role: string;
  signature_status: string;
  share_percentage: number;
}

interface LeaseInfo {
  id: string;
  property_address: string;
  type_bail: string;
  loyer: number;
  charges: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function TenantColocationPage() {
  const [loading, setLoading] = useState(true);
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [lease, setLease] = useState<LeaseInfo | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentProfileId, setCurrentProfileId] = useState<string>("");
  const [isMainTenant, setIsMainTenant] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Get current profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError) {
        logger.error("Erreur récupération profil colocation", { error: profileError.message });
      }
      if (!profile) return;
      setCurrentProfileId(profile.id);

      // Get lease with signers
      const { data: leaseSigners, error: leaseSignersError } = await supabase
        .from("lease_signers")
        .select(`
          id,
          role,
          signature_status,
          profiles!inner (
            id,
            user_id,
            prenom,
            nom,
            email,
            telephone,
            avatar_url
          ),
          leases!inner (
            id,
            type_bail,
            loyer,
            charges_forfaitaires,
            statut,
            date_debut,
            date_fin,
            properties!inner (
              id,
              adresse_complete,
              ville,
              code_postal,
              type,
              surface,
              surface_habitable_m2,
              nb_pieces,
              dpe_classe_energie,
              dpe_classe_climat,
              cover_url,
              owner_id
            )
          )
        `)
        .eq("profiles.user_id", user.id)
        .in("role", ["locataire_principal", "colocataire"])
        .single();

      if (leaseSignersError) {
        logger.error("Erreur récupération bail colocation", { error: leaseSignersError.message });
      }
      if (!leaseSigners) {
        setLoading(false);
        return;
      }

      const leaseData = leaseSigners.leases as { id: string; type_bail: string; loyer: number; charges_forfaitaires: number; properties: { adresse_complete: string; code_postal: string; ville: string } };
      const propertyData = leaseData.properties;

      setLease({
        id: leaseData.id,
        property_address: `${propertyData.adresse_complete}, ${propertyData.code_postal} ${propertyData.ville}`,
        type_bail: leaseData.type_bail,
        loyer: leaseData.loyer,
        charges: leaseData.charges_forfaitaires,
      });

      // Check if current user is main tenant
      setIsMainTenant(leaseSigners.role === "locataire_principal");

      // Get all roommates for this lease
      const { data: allSigners, error: allSignersError } = await supabase
        .from("lease_signers")
        .select(`
          id,
          role,
          signature_status,
          share_percentage,
          profiles (
            id,
            user_id,
            prenom,
            nom,
            email,
            telephone,
            avatar_url
          )
        `)
        .eq("lease_id", leaseData.id)
        .in("role", ["locataire_principal", "colocataire"]);

      if (allSignersError) {
        logger.error("Erreur récupération colocataires", { error: allSignersError.message });
      }
      if (allSigners) {
        const defaultShare = 100 / allSigners.length;
        const roommatesList: Roommate[] = allSigners
          .filter((signer) => signer.profiles !== null)
          .map((signer) => {
            const share = (signer as { share_percentage?: number | null }).share_percentage;
            return {
              id: signer.profiles!.id,
              name: `${signer.profiles!.prenom || ""} ${signer.profiles!.nom || ""}`.trim() || "Non renseigné",
              email: signer.profiles!.email ?? undefined,
              phone: signer.profiles!.telephone ?? undefined,
              avatar: signer.profiles!.avatar_url ?? undefined,
              role: signer.role,
              signature_status: signer.signature_status,
              share_percentage: typeof share === "number" ? share : defaultShare,
            };
          });
        setRoommates(roommatesList);
      }
    } catch (error) {
      logger.error("Erreur chargement colocation", { error: error instanceof Error ? error : String(error) });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (roommates.length <= 1) {
    return (
      <PageTransition>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardContent className="py-16 text-center">
              <Users className="h-16 w-16 mx-auto text-muted-foreground/30 mb-6" />
              <h2 className="text-2xl font-bold mb-2">Pas de colocation active</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Vous n'avez pas de colocataires pour le moment. Cette page sera disponible 
                lorsque vous partagerez votre logement avec d'autres personnes.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="container mx-auto px-4 py-8 max-w-6xl space-y-8"
      >
        {/* Header */}
        <motion.div variants={itemVariants}>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Ma colocation</h1>
              <p className="text-muted-foreground mt-1">
                Gérez les dépenses, tâches et règles avec vos colocataires
              </p>
            </div>
            {lease && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Home className="h-4 w-4" />
                {lease.property_address}
              </div>
            )}
          </div>
        </motion.div>

        {/* Roommates overview: ColocBoard (payment status) + legacy list from lease_signers */}
        <motion.div variants={itemVariants} className="space-y-4">
          {lease?.id && (
            <ColocBoard
              leaseId={lease.id}
              month={new Date().toISOString().slice(0, 7) + "-01"}
            />
          )}
          <GlassCard gradient className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-600" />
                Mes colocataires ({roommates.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {roommates.map((roommate) => {
                  const isMe = roommate.id === currentProfileId;
                  return (
                    <div
                      key={roommate.id}
                      className={`flex items-center gap-3 p-4 rounded-xl bg-white/80 border ${
                        isMe ? "border-indigo-200 ring-2 ring-indigo-100" : "border-gray-100"
                      }`}
                    >
                      <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                        {roommate.avatar && <AvatarImage src={roommate.avatar} />}
                        <AvatarFallback className={isMe ? "bg-indigo-100 text-indigo-600" : "bg-gray-100"}>
                          {roommate.name.split(" ").map(n => n[0]).join("").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {isMe ? "Vous" : roommate.name}
                          {roommate.role === "locataire_principal" && (
                            <Badge variant="secondary" className="text-xs">Principal</Badge>
                          )}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {roommate.signature_status === "signed" ? (
                            <span className="text-xs text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Bail signé
                            </span>
                          ) : (
                            <span className="text-xs text-amber-600 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Signature en attente
                            </span>
                          )}
                        </div>
                        {!isMe && roommate.email && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {roommate.email}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </GlassCard>
        </motion.div>

        {/* Main content with tabs */}
        <motion.div variants={itemVariants}>
          <Tabs defaultValue="expenses" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
              <TabsTrigger value="expenses" className="flex items-center gap-2">
                <Euro className="h-4 w-4" />
                <span className="hidden sm:inline">Dépenses</span>
              </TabsTrigger>
              <TabsTrigger value="chores" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">Tâches</span>
              </TabsTrigger>
              <TabsTrigger value="rules" className="flex items-center gap-2">
                <ScrollText className="h-4 w-4" />
                <span className="hidden sm:inline">Règlement</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="expenses" className="mt-6">
              <ColocExpenseSplit
                leaseId={lease?.id || ""}
                roommates={roommates}
                currentUserId={currentProfileId}
              />
            </TabsContent>

            <TabsContent value="chores" className="mt-6">
              <ColocChores
                leaseId={lease?.id || ""}
                roommates={roommates}
                currentUserId={currentProfileId}
              />
            </TabsContent>

            <TabsContent value="rules" className="mt-6">
              <ColocHouseRules
                leaseId={lease?.id || ""}
                roommates={roommates}
                currentUserId={currentProfileId}
                isMainTenant={isMainTenant}
              />
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>
    </PageTransition>
  );
}
