'use client';

// =====================================================
// Badges prestataire
// Nouveau, Vérifié, Top, Expert, Urgence
// =====================================================

import { 
  Sparkles, 
  BadgeCheck, 
  Star, 
  Award, 
  Zap,
  Clock,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Type de badge prestataire
 */
export type ProviderBadgeType = 
  | 'new'           // < 5 interventions
  | 'verified'      // KYC complet
  | 'top'           // > 50 avis, > 4.5 étoiles
  | 'expert'        // > 100 avis, > 4.7 étoiles
  | 'urgent'        // Disponible en urgence
  | 'responsive'    // Temps de réponse rapide
  | 'certified'     // Certifications (RGE, etc.)
  | 'recommended';  // Recommandé par la plateforme

interface BadgeConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const BADGE_CONFIGS: Record<ProviderBadgeType, BadgeConfig> = {
  new: {
    icon: Sparkles,
    label: 'Nouveau',
    description: 'Prestataire récent sur la plateforme',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  verified: {
    icon: BadgeCheck,
    label: 'Vérifié',
    description: 'Documents de conformité vérifiés (URSSAF, Kbis)',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  top: {
    icon: Star,
    label: 'Top',
    description: 'Plus de 50 avis avec une note supérieure à 4.5/5',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  expert: {
    icon: Award,
    label: 'Expert',
    description: 'Plus de 100 avis avec une note supérieure à 4.7/5',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  urgent: {
    icon: Zap,
    label: 'Urgence',
    description: 'Disponible pour les interventions urgentes',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  responsive: {
    icon: Clock,
    label: 'Réactif',
    description: 'Temps de réponse moyen inférieur à 2 heures',
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
  },
  certified: {
    icon: Shield,
    label: 'Certifié',
    description: 'Possède des certifications professionnelles (RGE, Qualibat...)',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
  recommended: {
    icon: TrendingUp,
    label: 'Recommandé',
    description: 'Recommandé par la plateforme pour sa qualité de service',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
};

interface ProviderBadgeProps {
  type: ProviderBadgeType;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
  lg: 'text-base px-2.5 py-1.5',
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function ProviderBadge({
  type,
  showTooltip = true,
  size = 'md',
  className = '',
}: ProviderBadgeProps) {
  const config = BADGE_CONFIGS[type];
  const Icon = config.icon;
  
  const badge = (
    <Badge 
      variant="outline" 
      className={`${config.bgColor} ${config.color} ${config.borderColor} ${sizeClasses[size]} ${className}`}
    >
      <Icon className={`${iconSizes[size]} mr-1`} />
      {config.label}
    </Badge>
  );
  
  if (!showTooltip) {
    return badge;
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Détermine les badges d'un prestataire
 */
export interface ProviderStats {
  interventionCount: number;
  reviewCount: number;
  averageRating: number;
  kycStatus: string;
  isUrgentAvailable: boolean;
  avgResponseTimeHours?: number;
  hasCertifications: boolean;
  isRecommended?: boolean;
}

export function getProviderBadges(stats: ProviderStats): ProviderBadgeType[] {
  const badges: ProviderBadgeType[] = [];
  
  // Nouveau (< 5 interventions)
  if (stats.interventionCount < 5) {
    badges.push('new');
  }
  
  // Vérifié (KYC complet)
  if (stats.kycStatus === 'verified') {
    badges.push('verified');
  }
  
  // Expert (> 100 avis, > 4.7 étoiles)
  if (stats.reviewCount > 100 && stats.averageRating >= 4.7) {
    badges.push('expert');
  }
  // Top (> 50 avis, > 4.5 étoiles) - exclusif avec Expert
  else if (stats.reviewCount > 50 && stats.averageRating >= 4.5) {
    badges.push('top');
  }
  
  // Urgence
  if (stats.isUrgentAvailable) {
    badges.push('urgent');
  }
  
  // Réactif (< 2h de réponse moyenne)
  if (stats.avgResponseTimeHours !== undefined && stats.avgResponseTimeHours < 2) {
    badges.push('responsive');
  }
  
  // Certifié
  if (stats.hasCertifications) {
    badges.push('certified');
  }
  
  // Recommandé
  if (stats.isRecommended) {
    badges.push('recommended');
  }
  
  return badges;
}

/**
 * Liste de badges
 */
interface ProviderBadgeListProps {
  badges: ProviderBadgeType[];
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  maxVisible?: number;
  className?: string;
}

export function ProviderBadgeList({
  badges,
  showTooltip = true,
  size = 'sm',
  maxVisible = 4,
  className = '',
}: ProviderBadgeListProps) {
  const visibleBadges = badges.slice(0, maxVisible);
  const hiddenCount = badges.length - maxVisible;
  
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {visibleBadges.map(badge => (
        <ProviderBadge 
          key={badge} 
          type={badge} 
          showTooltip={showTooltip} 
          size={size} 
        />
      ))}
      {hiddenCount > 0 && (
        <Badge variant="secondary" className={sizeClasses[size]}>
          +{hiddenCount}
        </Badge>
      )}
    </div>
  );
}

/**
 * Badge de note avec seuil
 */
interface RatingBadgeProps {
  rating: number;
  reviewCount: number;
  minReviewsToShow?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RatingBadge({
  rating,
  reviewCount,
  minReviewsToShow = 5,
  size = 'md',
  className = '',
}: RatingBadgeProps) {
  // Ne pas afficher si pas assez d'avis
  if (reviewCount < minReviewsToShow) {
    return (
      <Badge variant="outline" className={`text-gray-500 ${sizeClasses[size]} ${className}`}>
        <Star className={`${iconSizes[size]} mr-1`} />
        Nouveau
      </Badge>
    );
  }
  
  // Couleur selon la note
  let colorClass = 'text-gray-600 bg-gray-50 border-gray-200';
  if (rating >= 4.5) {
    colorClass = 'text-green-700 bg-green-50 border-green-200';
  } else if (rating >= 4.0) {
    colorClass = 'text-blue-700 bg-blue-50 border-blue-200';
  } else if (rating >= 3.0) {
    colorClass = 'text-amber-700 bg-amber-50 border-amber-200';
  } else {
    colorClass = 'text-red-700 bg-red-50 border-red-200';
  }
  
  return (
    <Badge variant="outline" className={`${colorClass} ${sizeClasses[size]} ${className}`}>
      <Star className={`${iconSizes[size]} mr-1 fill-current`} />
      {rating.toFixed(1)} ({reviewCount})
    </Badge>
  );
}

