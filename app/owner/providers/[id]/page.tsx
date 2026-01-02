'use client';

// =====================================================
// Fiche détaillée prestataire
// Vue propriétaire
// =====================================================

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { 
  ArrowLeft,
  MapPin, 
  Star, 
  MessageSquare,
  Heart,
  Phone,
  Mail,
  Clock,
  Euro,
  Calendar,
  Shield,
  Award,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  CheckCircle,
  ImageIcon,
  FileText,
  ThumbsUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  ProviderBadgeList, 
  RatingBadge, 
  getProviderBadges,
  type ProviderStats,
} from '@/components/provider/provider-badges';
import { SERVICE_TYPE_LABELS } from '@/lib/data/service-pricing-reference';
import { VigilanceAlert } from '@/components/vigilance/vigilance-alert';
import type { VigilanceCheckResult } from '@/lib/data/legal-thresholds';

interface ProviderDetail {
  id: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  services: string[];
  rating: number;
  review_count: number;
  intervention_count: number;
  location: string;
  address?: string;
  phone?: string;
  email?: string;
  hourly_rate_min?: number;
  hourly_rate_max?: number;
  is_urgent_available: boolean;
  response_time_hours?: number;
  kyc_status: string;
  has_certifications: boolean;
  certifications?: string[];
  created_at: string;
  portfolio: PortfolioItem[];
  reviews: Review[];
  stats: {
    completed_interventions: number;
    on_time_rate: number;
    satisfaction_rate: number;
    recommendation_rate: number;
  };
}

interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  service_type: string;
  before_photo_url?: string;
  after_photo_url: string;
  completed_at?: string;
  is_featured: boolean;
}

interface Review {
  id: string;
  author_name: string;
  author_avatar?: string;
  rating: number;
  comment: string;
  created_at: string;
  service_type?: string;
  provider_response?: string;
}

export default function ProviderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id as string;
  
  const [provider, setProvider] = useState<ProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [portfolioIndex, setPortfolioIndex] = useState(0);
  const [vigilanceResult, setVigilanceResult] = useState<VigilanceCheckResult | null>(null);
  
  useEffect(() => {
    fetchProvider();
  }, [providerId]);
  
  const fetchProvider = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/providers/${providerId}`);
      if (response.ok) {
        const data = await response.json();
        setProvider(data.provider);
      } else {
        // Données de démonstration
        setProvider(getDemoProvider());
      }
    } catch (error) {
      console.error('Erreur chargement prestataire:', error);
      setProvider(getDemoProvider());
    } finally {
      setLoading(false);
    }
  };
  
  const checkVigilance = async (amount: number) => {
    try {
      const response = await fetch('/api/vigilance/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: providerId,
          amount_ht: amount,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setVigilanceResult(data.vigilance);
      }
    } catch (error) {
      console.error('Erreur vérification vigilance:', error);
    }
  };
  
  if (loading) {
    return <ProviderDetailSkeleton />;
  }
  
  if (!provider) {
    return (
      <div className="container mx-auto py-12 text-center">
        <h1 className="text-2xl font-bold">Prestataire non trouvé</h1>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      </div>
    );
  }
  
  const stats: ProviderStats = {
    interventionCount: provider.intervention_count,
    reviewCount: provider.review_count,
    averageRating: provider.rating,
    kycStatus: provider.kyc_status,
    isUrgentAvailable: provider.is_urgent_available,
    avgResponseTimeHours: provider.response_time_hours,
    hasCertifications: provider.has_certifications,
  };
  
  const badges = getProviderBadges(stats);
  
  const initials = provider.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  const featuredPortfolio = provider.portfolio.filter(p => p.is_featured);
  const allPortfolio = provider.portfolio;
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header avec retour */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Fiche prestataire</h1>
      </div>
      
      {/* Carte principale */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar et infos principales */}
            <div className="flex flex-col items-center md:items-start gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={provider.avatar_url} alt={provider.name} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              
              <div className="text-center md:text-left">
                <h2 className="text-2xl font-bold">{provider.name}</h2>
                <div className="flex items-center gap-2 text-muted-foreground mt-1">
                  <MapPin className="h-4 w-4" />
                  {provider.location}
                </div>
                
                <div className="mt-3">
                  <RatingBadge 
                    rating={provider.rating} 
                    reviewCount={provider.review_count} 
                    size="md"
                  />
                </div>
                
                <div className="mt-3">
                  <ProviderBadgeList badges={badges} size="sm" maxVisible={5} />
                </div>
              </div>
            </div>
            
            {/* Stats et actions */}
            <div className="flex-1 space-y-4">
              {/* Services */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Services</h3>
                <div className="flex flex-wrap gap-2">
                  {provider.services.map(service => (
                    <Badge key={service} variant="secondary">
                      {SERVICE_TYPE_LABELS[service as keyof typeof SERVICE_TYPE_LABELS] || service}
                    </Badge>
                  ))}
                </div>
              </div>
              
              {/* Stats rapides */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {provider.stats.completed_interventions}
                  </div>
                  <div className="text-xs text-muted-foreground">Interventions</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {provider.stats.on_time_rate}%
                  </div>
                  <div className="text-xs text-muted-foreground">À l'heure</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {provider.stats.satisfaction_rate}%
                  </div>
                  <div className="text-xs text-muted-foreground">Satisfaction</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-amber-600">
                    {provider.stats.recommendation_rate}%
                  </div>
                  <div className="text-xs text-muted-foreground">Recommandé</div>
                </div>
              </div>
              
              {/* Tarifs */}
              {provider.hourly_rate_min && (
                <div className="flex items-center gap-2 text-lg">
                  <Euro className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold">
                    {provider.hourly_rate_min}€
                    {provider.hourly_rate_max && provider.hourly_rate_max !== provider.hourly_rate_min && 
                      ` - ${provider.hourly_rate_max}€`
                    }
                  </span>
                  <span className="text-muted-foreground">/ heure</span>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                <Button 
                  size="lg"
                  onClick={() => router.push(`/owner/tickets/new?provider=${provider.id}`)}
                >
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Demander un devis
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={isFavorite ? 'text-red-500 border-red-200' : ''}
                >
                  <Heart className={`h-5 w-5 mr-2 ${isFavorite ? 'fill-current' : ''}`} />
                  {isFavorite ? 'Favori' : 'Ajouter aux favoris'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Onglets de contenu */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start">
          <TabsTrigger value="overview">Présentation</TabsTrigger>
          <TabsTrigger value="portfolio">
            Portfolio ({allPortfolio.length})
          </TabsTrigger>
          <TabsTrigger value="reviews">
            Avis ({provider.review_count})
          </TabsTrigger>
          <TabsTrigger value="compliance">Conformité</TabsTrigger>
        </TabsList>
        
        {/* Présentation */}
        <TabsContent value="overview" className="space-y-6">
          {provider.bio && (
            <Card>
              <CardHeader>
                <CardTitle>À propos</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{provider.bio}</p>
              </CardContent>
            </Card>
          )}
          
          {/* Portfolio en vedette */}
          {featuredPortfolio.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Réalisations en vedette
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {featuredPortfolio.map(item => (
                    <PortfolioCard key={item.id} item={item} />
                  ))}
                </div>
                {allPortfolio.length > 3 && (
                  <Button 
                    variant="link" 
                    className="mt-4"
                    onClick={() => setActiveTab('portfolio')}
                  >
                    Voir toutes les réalisations ({allPortfolio.length})
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Derniers avis */}
          {provider.reviews.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Derniers avis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {provider.reviews.slice(0, 3).map(review => (
                  <ReviewCard key={review.id} review={review} />
                ))}
                {provider.reviews.length > 3 && (
                  <Button 
                    variant="link"
                    onClick={() => setActiveTab('reviews')}
                  >
                    Voir tous les avis ({provider.review_count})
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Certifications */}
          {provider.certifications && provider.certifications.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Certifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {provider.certifications.map(cert => (
                    <Badge key={cert} variant="outline" className="text-green-700 border-green-200 bg-green-50">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      {cert}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Portfolio complet */}
        <TabsContent value="portfolio">
          <Card>
            <CardHeader>
              <CardTitle>Toutes les réalisations</CardTitle>
              <CardDescription>
                {allPortfolio.length} réalisations documentées
              </CardDescription>
            </CardHeader>
            <CardContent>
              {allPortfolio.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Aucune réalisation pour le moment</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allPortfolio.map(item => (
                    <PortfolioCard key={item.id} item={item} showDetails />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Avis */}
        <TabsContent value="reviews">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Avis clients</CardTitle>
                  <CardDescription>
                    {provider.review_count} avis • {provider.rating.toFixed(1)}/5 de moyenne
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold">{provider.rating.toFixed(1)}</div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star 
                        key={i} 
                        className={`h-4 w-4 ${i <= Math.round(provider.rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} 
                      />
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {provider.reviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Aucun avis pour le moment</p>
                </div>
              ) : (
                provider.reviews.map(review => (
                  <ReviewCard key={review.id} review={review} showFull />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Conformité */}
        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Documents de conformité
              </CardTitle>
              <CardDescription>
                Vérification des obligations légales du prestataire
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${provider.kyc_status === 'verified' ? 'bg-green-100' : 'bg-amber-100'}`}>
                      <FileText className={`h-5 w-5 ${provider.kyc_status === 'verified' ? 'text-green-600' : 'text-amber-600'}`} />
                    </div>
                    <div>
                      <div className="font-medium">Attestation URSSAF</div>
                      <div className="text-sm text-muted-foreground">Attestation de vigilance</div>
                    </div>
                  </div>
                  <Badge variant={provider.kyc_status === 'verified' ? 'default' : 'secondary'}>
                    {provider.kyc_status === 'verified' ? 'Vérifié' : 'En attente'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${provider.kyc_status === 'verified' ? 'bg-green-100' : 'bg-amber-100'}`}>
                      <FileText className={`h-5 w-5 ${provider.kyc_status === 'verified' ? 'text-green-600' : 'text-amber-600'}`} />
                    </div>
                    <div>
                      <div className="font-medium">Extrait Kbis</div>
                      <div className="text-sm text-muted-foreground">Immatriculation société</div>
                    </div>
                  </div>
                  <Badge variant={provider.kyc_status === 'verified' ? 'default' : 'secondary'}>
                    {provider.kyc_status === 'verified' ? 'Vérifié' : 'En attente'}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${provider.kyc_status === 'verified' ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <Shield className={`h-5 w-5 ${provider.kyc_status === 'verified' ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="font-medium">Assurance RC Pro</div>
                      <div className="text-sm text-muted-foreground">Responsabilité civile professionnelle</div>
                    </div>
                  </div>
                  <Badge variant={provider.kyc_status === 'verified' ? 'default' : 'outline'}>
                    {provider.kyc_status === 'verified' ? 'Vérifié' : 'Non fourni'}
                  </Badge>
                </div>
              </div>
              
              {/* Test vigilance */}
              <Separator className="my-6" />
              
              <div>
                <h4 className="font-medium mb-3">Vérifier l'obligation de vigilance</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Pour les prestations supérieures à 5 000€ HT, vous devez vérifier les documents du prestataire.
                </p>
                <Button variant="outline" onClick={() => checkVigilance(6000)}>
                  Tester avec 6 000€ HT
                </Button>
              </div>
              
              {vigilanceResult && (
                <div className="mt-4">
                  <VigilanceAlert result={vigilanceResult} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Composant carte portfolio
function PortfolioCard({ item, showDetails = false }: { item: PortfolioItem; showDetails?: boolean }) {
  return (
    <div className="border rounded-lg overflow-hidden group">
      <div className="relative aspect-[4/3] bg-gray-100">
        {item.before_photo_url && (
          <div className="absolute inset-0 flex">
            <div className="flex-1 relative">
              <Image
                src={item.before_photo_url}
                alt="Avant"
                fill
                className="object-cover"
              />
              <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1 rounded">
                Avant
              </span>
            </div>
            <div className="flex-1 relative border-l-2 border-white">
              <Image
                src={item.after_photo_url}
                alt="Après"
                fill
                className="object-cover"
              />
              <span className="absolute bottom-1 right-1 text-xs bg-black/60 text-white px-1 rounded">
                Après
              </span>
            </div>
          </div>
        )}
        {!item.before_photo_url && (
          <Image
            src={item.after_photo_url}
            alt={item.title}
            fill
            className="object-cover"
          />
        )}
        {item.is_featured && (
          <Badge className="absolute top-2 right-2 bg-amber-500">
            <Star className="h-3 w-3 mr-1" />
            En vedette
          </Badge>
        )}
      </div>
      <div className="p-3">
        <h4 className="font-medium truncate">{item.title}</h4>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {SERVICE_TYPE_LABELS[item.service_type as keyof typeof SERVICE_TYPE_LABELS] || item.service_type}
          </Badge>
          {item.completed_at && (
            <span>{new Date(item.completed_at).toLocaleDateString('fr-FR')}</span>
          )}
        </div>
        {showDetails && item.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}

// Composant carte avis
function ReviewCard({ review, showFull = false }: { review: Review; showFull?: boolean }) {
  return (
    <div className="border-b last:border-0 pb-4 last:pb-0">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={review.author_avatar} alt={review.author_name} />
          <AvatarFallback>
            {review.author_name.split(' ').map(n => n[0]).join('').toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="font-medium">{review.author_name}</div>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(i => (
                <Star 
                  key={i} 
                  className={`h-4 w-4 ${i <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} 
                />
              ))}
            </div>
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            {new Date(review.created_at).toLocaleDateString('fr-FR')}
            {review.service_type && (
              <> • {SERVICE_TYPE_LABELS[review.service_type as keyof typeof SERVICE_TYPE_LABELS] || review.service_type}</>
            )}
          </div>
          <p className={`text-sm text-muted-foreground ${!showFull && 'line-clamp-2'}`}>
            {review.comment}
          </p>
          {review.provider_response && showFull && (
            <div className="mt-3 pl-4 border-l-2 border-primary/20">
              <div className="text-xs font-medium text-primary mb-1">Réponse du prestataire</div>
              <p className="text-sm text-muted-foreground">{review.provider_response}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Skeleton de chargement
function ProviderDetailSkeleton() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Données de démonstration
function getDemoProvider(): ProviderDetail {
  return {
    id: '1',
    name: 'Jean Dupont',
    avatar_url: undefined,
    bio: 'Plombier chauffagiste depuis 15 ans, je mets mon expertise au service des particuliers et professionnels. Formé aux dernières normes et certifié RGE, j\'interviens pour tous vos travaux de plomberie et chauffage.',
    services: ['plomberie', 'chauffage_clim'],
    rating: 4.8,
    review_count: 67,
    intervention_count: 120,
    location: 'Paris 11e',
    address: '42 Rue de la République, 75011 Paris',
    phone: '06 12 34 56 78',
    email: 'jean.dupont@email.com',
    hourly_rate_min: 45,
    hourly_rate_max: 65,
    is_urgent_available: true,
    response_time_hours: 1.5,
    kyc_status: 'verified',
    has_certifications: true,
    certifications: ['RGE QualiPAC', 'Qualibat'],
    created_at: '2022-03-15',
    portfolio: [
      {
        id: '1',
        title: 'Rénovation salle de bain complète',
        description: 'Remplacement complet de la plomberie et installation d\'une douche à l\'italienne',
        service_type: 'plomberie',
        before_photo_url: 'https://placehold.co/400x300/e2e8f0/64748b?text=Avant',
        after_photo_url: 'https://placehold.co/400x300/dcfce7/16a34a?text=Après',
        completed_at: '2024-01-15',
        is_featured: true,
      },
      {
        id: '2',
        title: 'Installation chaudière gaz',
        description: 'Remplacement ancienne chaudière par modèle à condensation',
        service_type: 'chauffage_clim',
        after_photo_url: 'https://placehold.co/400x300/dbeafe/3b82f6?text=Chaudière',
        completed_at: '2024-02-20',
        is_featured: true,
      },
      {
        id: '3',
        title: 'Réparation fuite sous évier',
        service_type: 'plomberie',
        before_photo_url: 'https://placehold.co/400x300/fee2e2/ef4444?text=Fuite',
        after_photo_url: 'https://placehold.co/400x300/dcfce7/16a34a?text=Réparé',
        completed_at: '2024-03-05',
        is_featured: false,
      },
    ],
    reviews: [
      {
        id: '1',
        author_name: 'Marie L.',
        rating: 5,
        comment: 'Excellent travail ! Jean est intervenu rapidement pour réparer une fuite urgente. Très professionnel et propre.',
        created_at: '2024-03-01',
        service_type: 'plomberie',
      },
      {
        id: '2',
        author_name: 'Pierre M.',
        rating: 5,
        comment: 'Installation de ma nouvelle chaudière réalisée dans les règles de l\'art. Explications claires et prix raisonnable.',
        created_at: '2024-02-25',
        service_type: 'chauffage_clim',
        provider_response: 'Merci Pierre pour votre confiance ! N\'hésitez pas à me recontacter pour l\'entretien annuel.',
      },
      {
        id: '3',
        author_name: 'Sophie D.',
        rating: 4,
        comment: 'Bon travail, intervention rapide. Juste un peu de retard à l\'arrivée mais travail soigné.',
        created_at: '2024-02-10',
        service_type: 'plomberie',
      },
    ],
    stats: {
      completed_interventions: 120,
      on_time_rate: 94,
      satisfaction_rate: 97,
      recommendation_rate: 95,
    },
  };
}

