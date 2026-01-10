'use client';

// =====================================================
// Galerie Avant/Après avec slider interactif
// =====================================================

import { useState, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X, ZoomIn, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  service_type: string;
  before_photo_url?: string;
  after_photo_url: string;
  completed_at?: string;
}

interface BeforeAfterGalleryProps {
  items: PortfolioItem[];
  className?: string;
}

/**
 * Galerie de photos avant/après avec navigation
 */
export function BeforeAfterGallery({ items, className }: BeforeAfterGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  if (items.length === 0) return null;
  
  const currentItem = items[currentIndex];
  
  const handlePrev = () => {
    setCurrentIndex(prev => (prev === 0 ? items.length - 1 : prev - 1));
  };
  
  const handleNext = () => {
    setCurrentIndex(prev => (prev === items.length - 1 ? 0 : prev + 1));
  };
  
  return (
    <div className={cn('space-y-4', className)}>
      {/* Image principale */}
      <div className="relative aspect-[16/9] bg-gray-100 rounded-lg overflow-hidden group">
        {currentItem.before_photo_url ? (
          <BeforeAfterSlider
            beforeUrl={currentItem.before_photo_url}
            afterUrl={currentItem.after_photo_url}
            title={currentItem.title}
          />
        ) : (
          <Image
            src={currentItem.after_photo_url}
            alt={currentItem.title}
            fill
            className="object-cover"
          />
        )}
        
        {/* Bouton plein écran */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => setIsFullscreen(true)}
          aria-label="Afficher en plein écran"
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </Button>
        
        {/* Navigation */}
        {items.length > 1 && (
          <>
            <Button
              variant="secondary"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handlePrev}
              aria-label="Image précédente"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleNext}
              aria-label="Image suivante"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </Button>
          </>
        )}
        
        {/* Indicateur */}
        {items.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1" role="tablist">
            {items.map((item, idx) => (
              <button
                key={idx}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  idx === currentIndex ? 'bg-white' : 'bg-white/50'
                )}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Aller à l'image ${idx + 1}: ${item.title}`}
                aria-selected={idx === currentIndex}
                role="tab"
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Infos */}
      <div>
        <h4 className="font-medium">{currentItem.title}</h4>
        {currentItem.description && (
          <p className="text-sm text-muted-foreground mt-1">{currentItem.description}</p>
        )}
      </div>
      
      {/* Thumbnails */}
      {items.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {items.map((item, idx) => (
            <button
              key={item.id}
              className={cn(
                'flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors',
                idx === currentIndex ? 'border-primary' : 'border-transparent'
              )}
              onClick={() => setCurrentIndex(idx)}
            >
              <Image
                src={item.after_photo_url}
                alt={item.title}
                width={80}
                height={80}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
      
      {/* Modal plein écran */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <DialogTitle className="sr-only">{currentItem.title}</DialogTitle>
          <div className="relative w-full h-[85vh]">
            {currentItem.before_photo_url ? (
              <BeforeAfterSlider
                beforeUrl={currentItem.before_photo_url}
                afterUrl={currentItem.after_photo_url}
                title={currentItem.title}
              />
            ) : (
              <Image
                src={currentItem.after_photo_url}
                alt={currentItem.title}
                fill
                className="object-contain"
              />
            )}
            
            {/* Navigation en plein écran */}
            {items.length > 1 && (
              <>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2"
                  onClick={handlePrev}
                  aria-label="Image précédente"
                >
                  <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  onClick={handleNext}
                  aria-label="Image suivante"
                >
                  <ChevronRight className="h-6 w-6" aria-hidden="true" />
                </Button>
              </>
            )}
          </div>
          
          <div className="p-4 bg-white">
            <h3 className="font-semibold text-lg">{currentItem.title}</h3>
            {currentItem.description && (
              <p className="text-muted-foreground mt-1">{currentItem.description}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Slider interactif avant/après
 */
interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  title: string;
  className?: string;
}

export function BeforeAfterSlider({ 
  beforeUrl, 
  afterUrl, 
  title,
  className 
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  
  const handleMouseDown = () => {
    isDragging.current = true;
  };
  
  const handleMouseUp = () => {
    isDragging.current = false;
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.min(Math.max((x / rect.width) * 100, 0), 100);
    setSliderPosition(percentage);
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const percentage = Math.min(Math.max((x / rect.width) * 100, 0), 100);
    setSliderPosition(percentage);
  };
  
  return (
    <div 
      ref={containerRef}
      className={cn('relative w-full h-full cursor-ew-resize select-none', className)}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
    >
      {/* Image APRÈS (fond) */}
      <Image
        src={afterUrl}
        alt={`${title} - Après`}
        fill
        className="object-cover"
        draggable={false}
      />
      
      {/* Image AVANT (clip) */}
      <div 
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
      >
        <Image
          src={beforeUrl}
          alt={`${title} - Avant`}
          fill
          className="object-cover"
          draggable={false}
        />
      </div>
      
      {/* Slider */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize z-10"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      >
        {/* Handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
          <ChevronLeft className="h-4 w-4 text-gray-600" />
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </div>
      </div>
      
      {/* Labels */}
      <Badge className="absolute top-2 left-2 bg-black/60 hover:bg-black/60">
        Avant
      </Badge>
      <Badge className="absolute top-2 right-2 bg-black/60 hover:bg-black/60">
        Après
      </Badge>
    </div>
  );
}

/**
 * Carte simple avant/après
 */
interface BeforeAfterCardProps {
  beforeUrl?: string;
  afterUrl: string;
  title: string;
  description?: string;
  serviceType?: string;
  completedAt?: string;
  onClick?: () => void;
  className?: string;
}

export function BeforeAfterCard({
  beforeUrl,
  afterUrl,
  title,
  description,
  serviceType,
  completedAt,
  onClick,
  className,
}: BeforeAfterCardProps) {
  return (
    <div 
      className={cn(
        'border rounded-lg overflow-hidden cursor-pointer group hover:shadow-md transition-shadow',
        className
      )}
      onClick={onClick}
    >
      <div className="relative aspect-[4/3] bg-gray-100">
        {beforeUrl ? (
          <div className="absolute inset-0 flex">
            <div className="flex-1 relative">
              <Image
                src={beforeUrl}
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
                src={afterUrl}
                alt="Après"
                fill
                className="object-cover"
              />
              <span className="absolute bottom-1 right-1 text-xs bg-black/60 text-white px-1 rounded">
                Après
              </span>
            </div>
          </div>
        ) : (
          <Image
            src={afterUrl}
            alt={title}
            fill
            className="object-cover"
          />
        )}
        
        {/* Overlay au survol */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      
      <div className="p-3">
        <h4 className="font-medium truncate">{title}</h4>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          {serviceType && (
            <Badge variant="outline" className="text-xs">{serviceType}</Badge>
          )}
          {completedAt && (
            <span>{new Date(completedAt).toLocaleDateString('fr-FR')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

