"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  ScrollText, 
  CheckCircle2, 
  Clock,
  Edit3,
  AlertCircle,
  FileText,
  Users
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDateShort } from "@/lib/helpers/format";

interface Roommate {
  id: string;
  name: string;
  avatar?: string;
}

interface HouseRule {
  id: string;
  version: number;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  acceptances: {
    roommate_id: string;
    accepted_at: string;
  }[];
}

interface Props {
  leaseId: string;
  roommates: Roommate[];
  currentUserId: string;
  isMainTenant?: boolean;
}

const DEFAULT_RULES_TEMPLATE = `# Règlement de la colocation

## 1. Respect des espaces communs
- Chaque colocataire est responsable du rangement des espaces communs après utilisation
- La vaisselle doit être faite dans les 24h suivant son utilisation
- Les courses communes sont partagées équitablement

## 2. Bruit et tranquillité
- Respecter le calme entre 22h et 8h en semaine
- Prévenir les autres colocataires en cas de soirée
- Utiliser un casque pour la musique/jeux après 22h

## 3. Visiteurs et invités
- Informer les colocataires de la venue d'invités
- Les invités ne peuvent pas rester plus de 3 nuits consécutives
- Les invités doivent respecter les règles de la colocation

## 4. Ménage et entretien
- Le planning des tâches doit être respecté
- Chaque colocataire est responsable de sa chambre
- Les parties communes sont entretenues à tour de rôle

## 5. Charges et dépenses
- Les charges communes sont réparties équitablement
- Les dépenses exceptionnelles doivent être validées par tous
- Les remboursements sont effectués sous 7 jours

## 6. Communication
- Un message de groupe est utilisé pour les discussions communes
- Les conflits sont résolus par discussion entre colocataires
- Une réunion mensuelle peut être organisée si nécessaire
`;

export function ColocHouseRules({ leaseId, roommates, currentUserId, isMainTenant = false }: Props) {
  const { toast } = useToast();
  const [rules, setRules] = useState<HouseRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  useEffect(() => {
    fetchRules();
  }, [leaseId]);

  const fetchRules = async () => {
    try {
      // Simuler les données pour la démo
      const mockRules: HouseRule = {
        id: "1",
        version: 1,
        title: "Règlement de la colocation",
        content: DEFAULT_RULES_TEMPLATE,
        created_by: currentUserId,
        created_at: "2025-01-01",
        acceptances: [
          { roommate_id: currentUserId, accepted_at: "2025-01-02" },
        ],
      };

      setRules(mockRules);
      setEditedContent(mockRules.content);
    } catch (error) {
      console.error("Erreur chargement règlement:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasAccepted = (roommateId: string) => {
    return rules?.acceptances.some(a => a.roommate_id === roommateId);
  };

  const allAccepted = () => {
    return roommates.every(r => hasAccepted(r.id));
  };

  const handleSaveRules = async () => {
    if (!editedContent.trim()) {
      toast({
        title: "Erreur",
        description: "Le règlement ne peut pas être vide",
        variant: "destructive",
      });
      return;
    }

    try {
      const newRules: HouseRule = {
        id: Date.now().toString(),
        version: (rules?.version || 0) + 1,
        title: "Règlement de la colocation",
        content: editedContent,
        created_by: currentUserId,
        created_at: new Date().toISOString(),
        acceptances: [], // Reset acceptances for new version
      };

      setRules(newRules);
      toast({
        title: "Règlement mis à jour",
        description: "Une nouvelle version a été créée. Les colocataires doivent re-valider.",
      });
      setEditDialogOpen(false);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le règlement",
        variant: "destructive",
      });
    }
  };

  const handleAcceptRules = async () => {
    if (!acceptTerms) {
      toast({
        title: "Erreur",
        description: "Vous devez accepter les conditions",
        variant: "destructive",
      });
      return;
    }

    try {
      if (rules) {
        const updatedRules = {
          ...rules,
          acceptances: [
            ...rules.acceptances,
            { roommate_id: currentUserId, accepted_at: new Date().toISOString() },
          ],
        };
        setRules(updatedRules);
      }

      toast({
        title: "Règlement accepté",
        description: "Vous avez validé le règlement de colocation",
      });
      setAcceptDialogOpen(false);
      setAcceptTerms(false);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de valider le règlement",
        variant: "destructive",
      });
    }
  };

  const getRoommateAcceptance = (roommateId: string) => {
    return rules?.acceptances.find(a => a.roommate_id === roommateId);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Chargement du règlement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ScrollText className="h-6 w-6 text-primary" />
            Règlement de colocation
          </h2>
          <p className="text-muted-foreground">
            {rules ? `Version ${rules.version} • Créé le ${formatDateShort(rules.created_at)}` : "Aucun règlement défini"}
          </p>
        </div>
        {isMainTenant && (
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Edit3 className="h-4 w-4 mr-2" />
                Modifier
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Modifier le règlement</DialogTitle>
                <DialogDescription>
                  Modifiez le règlement de colocation. Une nouvelle version sera créée et tous les colocataires devront la re-valider.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="content">Contenu (Markdown supporté)</Label>
                <Textarea
                  id="content"
                  className="mt-2 min-h-[400px] font-mono text-sm"
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleSaveRules}>
                  Enregistrer la nouvelle version
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </motion.div>

      {/* Acceptance status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className={allAccepted() ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5" />
              Statut de validation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {roommates.map(roommate => {
                const acceptance = getRoommateAcceptance(roommate.id);
                const isMe = roommate.id === currentUserId;
                
                return (
                  <div
                    key={roommate.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      acceptance ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-200"
                    }`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className={acceptance ? "bg-emerald-100" : "bg-gray-100"}>
                        {roommate.name.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {isMe ? "Vous" : roommate.name}
                      </p>
                      {acceptance ? (
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Validé
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          En attente
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Accept prompt for current user */}
      {rules && !hasAccepted(currentUserId) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <AlertCircle className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">Action requise</h3>
                  <p className="text-muted-foreground mt-1">
                    Vous devez lire et accepter le règlement de colocation pour finaliser votre installation.
                  </p>
                  <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="mt-4">
                        <FileText className="h-4 w-4 mr-2" />
                        Lire et accepter
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Règlement de colocation</DialogTitle>
                        <DialogDescription>
                          Veuillez lire attentivement le règlement avant de l'accepter
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <div className="prose prose-sm max-w-none bg-muted/30 p-6 rounded-lg max-h-[400px] overflow-y-auto">
                          <pre className="whitespace-pre-wrap font-sans text-sm">
                            {rules.content}
                          </pre>
                        </div>
                        <div className="flex items-center space-x-2 mt-6 p-4 bg-primary/5 rounded-lg">
                          <Checkbox
                            id="accept"
                            checked={acceptTerms}
                            onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                          />
                          <label
                            htmlFor="accept"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            J'ai lu et j'accepte le règlement de colocation
                          </label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setAcceptDialogOpen(false)}>
                          Annuler
                        </Button>
                        <Button onClick={handleAcceptRules} disabled={!acceptTerms}>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Valider
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Rules content */}
      {rules && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Contenu du règlement
              </CardTitle>
              <CardDescription>
                Version {rules.version}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm bg-muted/30 p-6 rounded-lg">
                  {rules.content}
                </pre>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* No rules state */}
      {!rules && (
        <Card>
          <CardContent className="py-12 text-center">
            <ScrollText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun règlement défini</h3>
            <p className="text-muted-foreground mb-4">
              {isMainTenant
                ? "Créez un règlement pour organiser la vie en colocation"
                : "Le locataire principal n'a pas encore créé de règlement"}
            </p>
            {isMainTenant && (
              <Button onClick={() => {
                setEditedContent(DEFAULT_RULES_TEMPLATE);
                setEditDialogOpen(true);
              }}>
                <Edit3 className="h-4 w-4 mr-2" />
                Créer le règlement
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

