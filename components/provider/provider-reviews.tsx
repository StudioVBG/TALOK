"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
  Star,
  StarHalf,
  ThumbsUp,
  MessageSquare,
  TrendingUp,
  Award,
  Clock,
  CheckCircle2,
  Flag
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface Review {
  id: string;
  overall_rating: number;
  punctuality_rating?: number;
  quality_rating?: number;
  communication_rating?: number;
  value_rating?: number;
  title?: string;
  comment?: string;
  would_recommend: boolean;
  provider_response?: string;
  provider_response_at?: string;
  created_at: string;
  reviewer_name: string;
  property_address?: string;
}

interface ProviderStats {
  total_reviews: number;
  average_rating: number;
  average_punctuality: number;
  average_quality: number;
  average_communication: number;
  average_value: number;
  recommendation_rate: number;
  response_rate: number;
  rating_1_count: number;
  rating_2_count: number;
  rating_3_count: number;
  rating_4_count: number;
  rating_5_count: number;
}

interface ProviderReviewsProps {
  providerId: string;
  isOwnProfile?: boolean;
}

export function ProviderReviews({ providerId, isOwnProfile = false }: ProviderReviewsProps) {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [response, setResponse] = useState("");
  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, [providerId]);

  const fetchData = async () => {
    try {
      // Récupérer les avis
      const { data: reviewsData } = await supabase
        .from("provider_reviews")
        .select(`
          *,
          reviewer:profiles!provider_reviews_reviewer_profile_id_fkey (
            prenom,
            nom
          ),
          property:properties (
            adresse_complete,
            ville
          )
        `)
        .eq("provider_profile_id", providerId)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (reviewsData) {
        setReviews(reviewsData.map((r: any) => ({
          ...r,
          reviewer_name: r.reviewer ? `${r.reviewer.prenom || ""} ${r.reviewer.nom || ""}`.trim() : "Anonyme",
          property_address: r.property ? `${r.property.adresse_complete}, ${r.property.ville}` : undefined,
        })));
      }

      // Récupérer les stats
      const { data: statsData } = await supabase
        .from("provider_stats")
        .select("*")
        .eq("provider_profile_id", providerId)
        .single();

      if (statsData) {
        setStats(statsData as any);
      }
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!selectedReview || !response.trim()) return;

    try {
      const { error } = await supabase
        .from("provider_reviews")
        .update({
          provider_response: response,
          provider_response_at: new Date().toISOString(),
        })
        .eq("id", selectedReview.id);

      if (error) throw error;

      toast({
        title: "Réponse publiée",
        description: "Votre réponse a été ajoutée à l'avis",
      });

      setResponseDialogOpen(false);
      setSelectedReview(null);
      setResponse("");
      fetchData();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de publier la réponse",
        variant: "destructive",
      });
    }
  };

  const renderStars = (rating: number, size: "sm" | "md" | "lg" = "md") => {
    const sizes = {
      sm: "h-3 w-3",
      md: "h-4 w-4",
      lg: "h-5 w-5"
    };
    
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizes[size]} ${
              star <= rating
                ? "text-yellow-400 fill-yellow-400"
                : "text-gray-200"
            }`}
          />
        ))}
      </div>
    );
  };

  const getRatingDistribution = () => {
    if (!stats) return [];
    const total = stats.total_reviews || 1;
    return [
      { stars: 5, count: stats.rating_5_count, percentage: (stats.rating_5_count / total) * 100 },
      { stars: 4, count: stats.rating_4_count, percentage: (stats.rating_4_count / total) * 100 },
      { stars: 3, count: stats.rating_3_count, percentage: (stats.rating_3_count / total) * 100 },
      { stars: 2, count: stats.rating_2_count, percentage: (stats.rating_2_count / total) * 100 },
      { stars: 1, count: stats.rating_1_count, percentage: (stats.rating_1_count / total) * 100 },
    ];
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-4 text-muted-foreground">Chargement des avis...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            Note globale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Left: Overall rating */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-5xl font-bold">
                  {stats?.average_rating?.toFixed(1) || "0.0"}
                </div>
                <div className="mt-2">
                  {renderStars(stats?.average_rating || 0, "lg")}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {stats?.total_reviews || 0} avis
                </p>
              </div>
              
              <div className="flex-1 space-y-2">
                {getRatingDistribution().map((dist) => (
                  <div key={dist.stars} className="flex items-center gap-2">
                    <span className="text-sm w-4">{dist.stars}</span>
                    <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                    <Progress value={dist.percentage} className="flex-1 h-2" />
                    <span className="text-sm text-muted-foreground w-8">{dist.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Detailed ratings & badges */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Ponctualité</span>
                  <span className="ml-auto font-semibold">
                    {stats?.average_punctuality?.toFixed(1) || "-"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Qualité</span>
                  <span className="ml-auto font-semibold">
                    {stats?.average_quality?.toFixed(1) || "-"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Communication</span>
                  <span className="ml-auto font-semibold">
                    {stats?.average_communication?.toFixed(1) || "-"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Rapport qualité/prix</span>
                  <span className="ml-auto font-semibold">
                    {stats?.average_value?.toFixed(1) || "-"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                {stats && stats.recommendation_rate >= 80 && (
                  <Badge className="bg-green-100 text-green-700">
                    <ThumbsUp className="h-3 w-3 mr-1" />
                    {Math.round(stats.recommendation_rate)}% recommandent
                  </Badge>
                )}
                {stats && stats.response_rate >= 80 && (
                  <Badge className="bg-blue-100 text-blue-700">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Répond aux avis
                  </Badge>
                )}
                {stats && stats.average_rating >= 4.5 && (
                  <Badge className="bg-amber-100 text-amber-700">
                    <Award className="h-3 w-3 mr-1" />
                    Top prestataire
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <CardTitle>Avis clients ({reviews.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Aucun avis pour le moment</p>
            </div>
          ) : (
            <div className="space-y-6">
              {reviews.map((review, index) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="pb-6 border-b last:border-0"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {review.reviewer_name.split(" ").map(n => n[0]).join("").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{review.reviewer_name}</p>
                          {review.would_recommend && (
                            <Badge variant="outline" className="text-xs">
                              <ThumbsUp className="h-3 w-3 mr-1" />
                              Recommande
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {renderStars(review.overall_rating, "sm")}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(review.created_at), {
                              addSuffix: true,
                              locale: fr
                            })}
                          </span>
                        </div>
                        {review.property_address && (
                          <p className="text-xs text-muted-foreground mt-1">
                            📍 {review.property_address}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {review.title && (
                    <h4 className="font-medium mt-4">{review.title}</h4>
                  )}
                  
                  {review.comment && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {review.comment}
                    </p>
                  )}

                  {/* Provider response */}
                  {review.provider_response && (
                    <div className="mt-4 ml-8 p-4 bg-muted/50 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Réponse du prestataire
                      </p>
                      <p className="text-sm">{review.provider_response}</p>
                    </div>
                  )}

                  {/* Response button for own profile */}
                  {isOwnProfile && !review.provider_response && (
                    <div className="mt-4 ml-8">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedReview(review);
                          setResponseDialogOpen(true);
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Répondre
                      </Button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Response Dialog */}
      <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Répondre à l'avis</DialogTitle>
            <DialogDescription>
              Votre réponse sera visible publiquement
            </DialogDescription>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {renderStars(selectedReview.overall_rating, "sm")}
                  <span className="font-medium">{selectedReview.reviewer_name}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedReview.comment || selectedReview.title || "Pas de commentaire"}
                </p>
              </div>

              <Textarea
                placeholder="Votre réponse..."
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                rows={4}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResponseDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmitResponse} disabled={!response.trim()}>
              Publier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export du composant pour laisser un avis
export function LeaveReviewButton({ 
  workOrderId, 
  providerId,
  onReviewSubmitted
}: { 
  workOrderId: string;
  providerId: string;
  onReviewSubmitted?: () => void;
}) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ratings, setRatings] = useState({
    overall: 0,
    punctuality: 0,
    quality: 0,
    communication: 0,
    value: 0,
  });
  const [comment, setComment] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  const handleSubmit = async () => {
    if (ratings.overall === 0) {
      toast({
        title: "Erreur",
        description: "Veuillez donner une note globale",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profil non trouvé");

      const { error } = await supabase
        .from("provider_reviews")
        .insert({
          provider_profile_id: providerId,
          reviewer_profile_id: profile.id,
          work_order_id: workOrderId,
          overall_rating: ratings.overall,
          punctuality_rating: ratings.punctuality || null,
          quality_rating: ratings.quality || null,
          communication_rating: ratings.communication || null,
          value_rating: ratings.value || null,
          comment: comment || null,
          would_recommend: wouldRecommend,
        });

      if (error) throw error;

      toast({
        title: "Avis publié",
        description: "Merci pour votre retour !",
      });

      setDialogOpen(false);
      onReviewSubmitted?.();
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de publier l'avis",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({ 
    value, 
    onChange, 
    label 
  }: { 
    value: number; 
    onChange: (v: number) => void; 
    label: string;
  }) => (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="p-0.5"
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                star <= value
                  ? "text-yellow-400 fill-yellow-400"
                  : "text-gray-200 hover:text-yellow-200"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <Button onClick={() => setDialogOpen(true)}>
        <Star className="h-4 w-4 mr-2" />
        Laisser un avis
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Donner votre avis</DialogTitle>
            <DialogDescription>
              Partagez votre expérience avec ce prestataire
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <StarRating
                label="Note globale *"
                value={ratings.overall}
                onChange={(v) => setRatings({ ...ratings, overall: v })}
              />
              <StarRating
                label="Ponctualité"
                value={ratings.punctuality}
                onChange={(v) => setRatings({ ...ratings, punctuality: v })}
              />
              <StarRating
                label="Qualité du travail"
                value={ratings.quality}
                onChange={(v) => setRatings({ ...ratings, quality: v })}
              />
              <StarRating
                label="Communication"
                value={ratings.communication}
                onChange={(v) => setRatings({ ...ratings, communication: v })}
              />
              <StarRating
                label="Rapport qualité/prix"
                value={ratings.value}
                onChange={(v) => setRatings({ ...ratings, value: v })}
              />
            </div>

            <Textarea
              placeholder="Votre commentaire (optionnel)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={wouldRecommend ? "default" : "outline"}
                size="sm"
                onClick={() => setWouldRecommend(true)}
              >
                <ThumbsUp className="h-4 w-4 mr-1" />
                Je recommande
              </Button>
              <Button
                type="button"
                variant={!wouldRecommend ? "destructive" : "outline"}
                size="sm"
                onClick={() => setWouldRecommend(false)}
              >
                Non recommandé
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Publication..." : "Publier l'avis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

