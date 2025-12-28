"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationsList } from "@/components/chat/conversations-list";
import { ChatWindow } from "@/components/chat/chat-window";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, ArrowRight } from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";
import type { Conversation } from "@/lib/services/chat.service";

export default function TenantMessagesPage() {
  const [loading, setLoading] = useState(true);
  const [currentProfileId, setCurrentProfileId] = useState<string>("");
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const supabase = createClient();

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
        if (!user) return;

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
  }, []);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
  };

  const handleBack = () => {
    setSelectedConversation(null);
  };

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

  // Vue mobile
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
              <h1 className="text-2xl font-bold mb-4">Messages</h1>
              <ConversationsList
                currentProfileId={currentProfileId}
                selectedId={selectedConversation?.id}
                onSelect={handleSelectConversation}
              />
            </div>
          )}
        </div>
      </PageTransition>
    );
  }

  // Vue desktop
  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground mt-1">
            Communiquez avec votre propriétaire
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid md:grid-cols-3 gap-6"
          style={{ height: "calc(100vh - 250px)", minHeight: "500px" }}
        >
          {/* Liste des conversations */}
          <div className="h-full">
            <ConversationsList
              currentProfileId={currentProfileId}
              selectedId={selectedConversation?.id}
              onSelect={handleSelectConversation}
            />
          </div>

          {/* Fenêtre de chat */}
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
                    Choisissez une conversation dans la liste pour commencer à discuter
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground">
                    <ArrowRight className="h-4 w-4" />
                    <span>Cliquez sur une conversation à gauche</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>
      </div>
    </PageTransition>
  );
}
