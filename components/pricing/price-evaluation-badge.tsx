'use client';

// =====================================================
// Composant d'évaluation de prix
// Affiche si un tarif est dans la moyenne du marché
// =====================================================

import { TrendingUp, TrendingDown, Minus, AlertTriangle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PriceEvaluationResult } from '@/lib/data/service-pricing-reference';

interface PriceEvaluationBadgeProps {
  evaluation: PriceEvaluationResult;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5',
};

const colorClasses = {
  green: 'bg-green-100 text-green-700 border-green-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
};

const icons = {
  below_average: TrendingDown,
  average: Minus,
  above_average: TrendingUp,
  expensive: AlertTriangle,
  suspicious: AlertTriangle,
};

export function PriceEvaluationBadge({
  evaluation,
  showTooltip = true,
  size = 'md',
  className = '',
}: PriceEvaluationBadgeProps) {
  const Icon = icons[evaluation.evaluation] || Info;
  const colorClass = colorClasses[evaluation.color as keyof typeof colorClasses] || colorClasses.gray;
  
  const badge = (
    <Badge 
      variant="outline" 
      className={`${colorClass} ${sizeClasses[size]} ${className}`}
    >
      <Icon className={`${size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
      {evaluation.label}
      {evaluation.percentFromAverage !== 0 && (
        <span className="ml-1 opacity-75">
          ({evaluation.percentFromAverage > 0 ? '+' : ''}{evaluation.percentFromAverage}%)
        </span>
      )}
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
        <TooltipContent className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">{evaluation.message}</p>
            <div className="text-xs text-muted-foreground">
              <p>Fourchette marché : {evaluation.referenceMin}€ - {evaluation.referenceMax}€/h</p>
              <p>Moyenne : {evaluation.referenceAverage}€/h</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Affichage détaillé de la comparaison tarifaire
 */
interface PriceComparisonProps {
  hourlyRate: number;
  evaluation: PriceEvaluationResult;
  isEmergency?: boolean;
  className?: string;
}

export function PriceComparison({
  hourlyRate,
  evaluation,
  isEmergency = false,
  className = '',
}: PriceComparisonProps) {
  const percentage = ((hourlyRate - evaluation.referenceMin) / (evaluation.referenceMax - evaluation.referenceMin)) * 100;
  const clampedPercentage = Math.max(0, Math.min(100, percentage));
  
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Tarif proposé</span>
        <span className="font-medium">{hourlyRate}€/h</span>
      </div>
      
      {/* Barre de comparaison */}
      <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
        {/* Zone verte (dans la moyenne) */}
        <div 
          className="absolute h-full bg-green-200" 
          style={{ left: '20%', width: '60%' }}
        />
        
        {/* Indicateur de position */}
        <div 
          className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow ${
            evaluation.evaluation === 'suspicious' ? 'bg-orange-500' :
            evaluation.evaluation === 'below_average' ? 'bg-green-500' :
            evaluation.evaluation === 'average' ? 'bg-blue-500' :
            evaluation.evaluation === 'above_average' ? 'bg-amber-500' :
            'bg-red-500'
          }`}
          style={{ left: `calc(${clampedPercentage}% - 6px)` }}
        />
      </div>
      
      {/* Légende */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{evaluation.referenceMin}€</span>
        <span className="text-center">Moyenne : {evaluation.referenceAverage}€</span>
        <span>{evaluation.referenceMax}€</span>
      </div>
      
      {/* Message */}
      <p className={`text-sm ${
        evaluation.evaluation === 'suspicious' || evaluation.evaluation === 'expensive' 
          ? 'text-amber-600' 
          : 'text-muted-foreground'
      }`}>
        {evaluation.message}
      </p>
      
      {isEmergency && (
        <p className="text-xs text-muted-foreground italic">
          * Tarifs ajustés pour une intervention d'urgence
        </p>
      )}
    </div>
  );
}

