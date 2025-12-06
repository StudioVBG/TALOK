'use client';

// =====================================================
// Carte prestataire pour la marketplace
// Vue propriétaire
// =====================================================

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  MapPin, 
  Star, 
  MessageSquare,
  Heart,
  ExternalLink,
  Phone,
  Clock,
  Euro,
  ChevronRight,
  ImageIcon,
} from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  ProviderBadgeList, 
  RatingBadge, 
  getProviderBadges,
  type ProviderStats,
  type ProviderBadgeType,
} from './provider-badges';
import { SERVICE_TYPE_LABELS } from '@/lib/data/service-pricing-reference';

/**
 * Données d'un prestataire
 */
export interface ProviderCardData {
  id: string;
  name: string;
  avatar_url?: string;
  services: string[];
  rating: number;
  review_count: number;
  intervention_count: number;
  location: string;
  distance_km?: number;
  hourly_rate_min?: number;
  hourly_rate_max?: number;
  is_urgent_available: boolean;
  response_time_hours?: number;
  kyc_status: string;
  has_certifications: boolean;
  portfolio_count: number;
  featured_portfolio?: {
    before_url?: string;
    after_url: string;
    title: string;
  };
  is_favorite?: boolean;
}

interface ProviderCardProps {
  provider: ProviderCardData;
  onRequestQuote?: (providerId: string) => void;
  onToggleFavorite?: (providerId: string) => void;
  showPortfolio?: boolean;
  className?: string;
}

export function ProviderCard({
  provider,
  onRequestQuote,
  onToggleFavorite,
  showPortfolio = true,
  className = '',
}: ProviderCardProps) {
  const [isFavorite, setIsFavorite] = useState(provider.is_favorite || false);
  
  // Calculer les badges
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
  
  // Initiales pour l'avatar
  const initials = provider.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  
  const handleFavoriteClick = () => {
    setIsFavorite(!isFavorite);
    onToggleFavorite?.(provider.id);
  };
  
  return (
    <Card className={`hover:shadow-md transition-shadow ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={provider.avatar_url} alt={provider.name} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <Link 
                href={`/app/owner/providers/${provider.id}`}
                className="font-semibold text-lg hover:text-primary transition-colors"
              >
                {provider.name}
              </Link>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {provider.location}
                {provider.distance_km !== undefined && (
                  <span className="text-xs">({provider.distance_km.toFixed(1)} km)</span>
                )}
              </div>
            </div>
          </div>
          
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFavoriteClick}
              className={isFavorite ? 'text-red-500' : 'text-gray-400'}
            >
              <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Services */}
        <div className="flex flex-wrap gap-1">
          {provider.services.slice(0, 3).map(service => (
            <Badge key={service} variant="secondary" className="text-xs">
              {SERVICE_TYPE_LABELS[service as keyof typeof SERVICE_TYPE_LABELS] || service}
            </Badge>
          ))}
          {provider.services.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{provider.services.length - 3}
            </Badge>
          )}
        </div>
        
        {/* Badges */}
        <ProviderBadgeList badges={badges} size="sm" maxVisible={3} />
        
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5">
            <RatingBadge 
              rating={provider.rating} 
              reviewCount={provider.review_count} 
              size="sm"
            />
          </div>
          
          {provider.hourly_rate_min && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Euro className="h-4 w-4" />
              <span>
                {provider.hourly_rate_min}€
                {provider.hourly_rate_max && provider.hourly_rate_max !== provider.hourly_rate_min && 
                  ` - ${provider.hourly_rate_max}€`
                }/h
              </span>
            </div>
          )}
          
          {provider.response_time_hours !== undefined && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                Répond en ~{provider.response_time_hours < 1 
                  ? `${Math.round(provider.response_time_hours * 60)} min`
                  : `${provider.response_time_hours}h`
                }
              </span>
            </div>
          )}
          
          {provider.portfolio_count > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              <span>{provider.portfolio_count} réalisations</span>
            </div>
          )}
        </div>
        
        {/* Portfolio preview */}
        {showPortfolio && provider.featured_portfolio && (
          <div className="mt-2 relative rounded-lg overflow-hidden bg-gray-100">
            <div className="flex">
              {provider.featured_portfolio.before_url && (
                <div className="flex-1 relative aspect-[4/3]">
                  <Image
                    src={provider.featured_portfolio.before_url}
                    alt="Avant"
                    fill
                    className="object-cover"
                  />
                  <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white px-1 rounded">
                    Avant
                  </span>
                </div>
              )}
              <div className={`flex-1 relative aspect-[4/3] ${provider.featured_portfolio.before_url ? 'border-l border-white' : ''}`}>
                <Image
                  src={provider.featured_portfolio.after_url}
                  alt="Après"
                  fill
                  className="object-cover"
                />
                <span className="absolute bottom-1 right-1 text-xs bg-black/60 text-white px-1 rounded">
                  Après
                </span>
              </div>
            </div>
            <p className="text-xs text-center py-1 text-muted-foreground truncate px-2">
              {provider.featured_portfolio.title}
            </p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-3 gap-2">
        {onRequestQuote && (
          <Button 
            className="flex-1"
            onClick={() => onRequestQuote(provider.id)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Demander un devis
          </Button>
        )}
        
        <Button variant="outline" asChild>
          <Link href={`/app/owner/providers/${provider.id}`}>
            Voir le profil
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * Version compacte pour les listes
 */
export function ProviderCardCompact({
  provider,
  onRequestQuote,
  className = '',
}: Omit<ProviderCardProps, 'showPortfolio' | 'onToggleFavorite'>) {
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
  
  return (
    <div className={`flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50 transition-colors ${className}`}>
      <Avatar className="h-10 w-10">
        <AvatarImage src={provider.avatar_url} alt={provider.name} />
        <AvatarFallback className="bg-primary/10 text-primary text-sm">
          {initials}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link 
            href={`/app/owner/providers/${provider.id}`}
            className="font-medium hover:text-primary truncate"
          >
            {provider.name}
          </Link>
          <RatingBadge 
            rating={provider.rating} 
            reviewCount={provider.review_count} 
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{provider.location}</span>
          {provider.hourly_rate_min && (
            <>
              <span>•</span>
              <span>{provider.hourly_rate_min}€/h</span>
            </>
          )}
        </div>
      </div>
      
      <ProviderBadgeList badges={badges.slice(0, 2)} size="sm" showTooltip={false} />
      
      {onRequestQuote && (
        <Button size="sm" onClick={() => onRequestQuote(provider.id)}>
          Devis
        </Button>
      )}
    </div>
  );
}

