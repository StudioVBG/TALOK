"use client";

/**
 * AUDIT UX: Composant de messagerie unifié
 * - Ajout du bouton "Nouvelle conversation" (prop newConversationData)
 * - Amélioration du empty state central avec CTA contextuel
 * - Sous-titre élargi aux prestataires
 */

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationsList } from "@/components/chat/conversations-list";
import { ChatWindow } from "@/components/chat/chat-window";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, PenSquare, Loader2 } from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import { chatService, type Conversation } from "@/lib/services/chat.service";
import { useToast } from "@/components/ui/use-toast";

export interface NewConversationData {
  property_id: string;
  owner_profile_id: string;
  tenant_profile_id: string;
  lease_id: string;
  ownerName: string;
}

interface MessagesPageContentProps {
  /** Sous-titre sous le titre "Messages" */
  subtitle: string;
  /** Si fourni, appelé quand l'utilisateur n'est pas authentifié (ex: redirect signin) */
  onNotAuthenticated?: () => void;
  /** AUDIT UX: Données pour créer une nouvelle conversation (tenant) */
  newConversationData?: NewConversationData;
}

export function MessagesPageContent({ subtitle, onNotAuthenticated, newConversationData }: MessagesPageContentProps) {
  const [loading, setLoading] = useState(true);
  const [currentProfileId, setCurrentProfileId] = useState<string>("");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          onNotAuthenticated?.();
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (profile) {
          setCurrentProfileId(profile.id);
        }
      } catch (error) {
        console.error("Erreur initialisation:", error);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [onNotAuthenticated]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleBack = () => {
    setSelectedConversation(null);
  };

  // AUDIT UX: Créer ou ouvrir une conversation avec le propriétaire
  const handleNewConversation = useCallback(async () => {
    if (!newConversationData) return;
    setIsCreatingConversation(true);
    try {
      const conversation = await chatService.getOrCreateConversation({
        property_id: newConversationData.property_id,
        owner_profile_id: newConversationData.owner_profile_id,
        tenant_profile_id: newConversationData.tenant_profile_id,
        lease_id: newConversationData.lease_id,
        subject: "Conversation avec mon propriétaire",
      });
      setSelectedConversation(conversation);
    } catch (error) {
      console.error("Erreur création conversation:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de créer la conversation. Veuillez réessayer.",
      });
    } finally {
      setIsCreatingConversation(false);
    }
  }, [newConversationData, toast]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Skeleton className="h-10 w-48 mb-6" />
        <div className="grid md:grid-cols-3 gap-6 h-[600px]">
          <Skeleton className="h-full" />
          <div className="md:col-span-2">
            <Skeleton className="h-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!currentProfileId) {
    return (
      <PageTransition>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardContent className="py-16 text-center">
              <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground/30 mb-6" />
              <h2 className="text-2xl font-bold mb-2">Messagerie non disponible</h2>
              <p className="text-muted-foreground">
                Impossible de charger votre profil.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    );
  }

  // AUDIT UX: Bouton nouvelle conversation réutilisable
  const NewConversationButton = newConversationData ? (
    <Button
      onClick={handleNewConversation}
      disabled={isCreatingConversation}
      className="bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl h-10 px-5 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30"
    >
      {isCreatingConversation ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ouverture...</>
      ) : (
        <><PenSquare className="h-4 w-4 mr-2" /> Nouvelle conversation</>
      )}
    </Button>
  ) : null;

  if (isMobile) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background">
          {selectedConversation ? (
            <div className="h-screen">
              <ChatWindow
                conversation={selectedConversation}
                currentProfileId={currentProfileId}
                onBack={handleBack}
              />
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold">Messages</h1>
                {NewConversationButton}
              </div>
              <ConversationsList
                currentProfileId={currentProfileId}
                selectedId={undefined}
                onSelect={handleSelectConversation}
              />
            </div>
          )}
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold">Messages</h1>
            <p className="text-muted-foreground mt-1">
              {subtitle}
            </p>
          </div>
          {NewConversationButton}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-3 gap-6"
          style={{ height: "calc(100vh - 250px)", minHeight: "500px" }}
        >
          <div className="h-full">
            <ConversationsList
              currentProfileId={currentProfileId}
              selectedId={selectedConversation?.id}
              onSelect={handleSelectConversation}
            />
          </div>

          <div className="md:col-span-2 h-full">
            {selectedConversation ? (
              <ChatWindow
                conversation={selectedConversation}
                currentProfileId={currentProfileId}
              />
            ) : (
              <Card className="h-full flex items-center justify-center">
                <CardContent className="text-center">
                  <div className="p-6 rounded-full bg-muted/50 inline-block mb-4">
                    <MessageSquare className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">
                    Sélectionnez une conversation
                  </h3>
                  <p className="text-muted-foreground max-w-sm">
                    Choisissez une conversation dans la liste ou démarrez une nouvelle discussion.
                  </p>
                  {newConversationData && (
                    <div className="mt-6">
                      <Button
                        variant="outline"
                        onClick={handleNewConversation}
                        disabled={isCreatingConversation}
                        className="font-bold"
                      >
                        {isCreatingConversation ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ouverture...</>
                        ) : (
                          <><PenSquare className="h-4 w-4 mr-2" /> Écrire à {newConversationData.ownerName}</>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
}
