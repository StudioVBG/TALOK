"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProviderReviews } from "@/components/provider/provider-reviews";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { PageTransition } from "@/components/ui/page-transition";

export default function ProviderReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const supabase = createClient();

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
          setProfileId(profile.id);
        }
      } catch (error) {
        console.error("Erreur:", error);
      } finally {
        setLoading(false);
      }
    }

    init();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!profileId) {
    return (
      <PageTransition>
        <div className="p-6">
          <Card>
            <CardContent className="py-16 text-center">
              <Star className="h-16 w-16 mx-auto text-muted-foreground/30 mb-6" />
              <h2 className="text-2xl font-bold mb-2">Avis non disponibles</h2>
              <p className="text-muted-foreground">
                Impossible de charger votre profil.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Star className="h-6 w-6 text-yellow-500" />
            Mes avis clients
          </h1>
          <p className="text-muted-foreground">
            Consultez et répondez aux avis de vos clients
          </p>
        </div>

        <ProviderReviews providerId={profileId} isOwnProfile={true} />
      </div>
    </PageTransition>
  );
}

