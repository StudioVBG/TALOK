'use client';

// =====================================================
// Page Marketplace Prestataires
// Vue propriétaire
// =====================================================

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Search, 
  Filter, 
  MapPin, 
  SlidersHorizontal,
  Grid,
  List,
  Star,
  Zap,
  RefreshCw,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ProviderCard, ProviderCardCompact, type ProviderCardData } from '@/components/provider/provider-card';
import { SERVICE_TYPE_LABELS, type ServiceType } from '@/lib/data/service-pricing-reference';

type SortOption = 'relevance' | 'rating' | 'price_asc' | 'price_desc' | 'distance' | 'reviews';
type ViewMode = 'grid' | 'list';

interface Filters {
  services: ServiceType[];
  minRating: number;
  maxPrice: number;
  urgentOnly: boolean;
  verifiedOnly: boolean;
  withPortfolio: boolean;
  location: string;
}

const defaultFilters: Filters = {
  services: [],
  minRating: 0,
  maxPrice: 200,
  urgentOnly: false,
  verifiedOnly: false,
  withPortfolio: false,
  location: '',
};

export default function ProvidersMarketplacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [providers, setProviders] = useState<ProviderCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  
  // Charger les filtres depuis l'URL
  useEffect(() => {
    const service = searchParams.get('service');
    if (service) {
      setFilters(prev => ({ ...prev, services: [service as ServiceType] }));
    }
  }, [searchParams]);
  
  // Charger les prestataires
  useEffect(() => {
    fetchProviders();
  }, [filters, sortBy, searchQuery]);
  
  const fetchProviders = async () => {
    setLoading(true);
    try {
      // Construction des paramètres de requête
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (filters.services.length > 0) params.set('services', filters.services.join(','));
      if (filters.minRating > 0) params.set('min_rating', filters.minRating.toString());
      if (filters.maxPrice < 200) params.set('max_price', filters.maxPrice.toString());
      if (filters.urgentOnly) params.set('urgent_only', 'true');
      if (filters.verifiedOnly) params.set('verified_only', 'true');
      if (filters.withPortfolio) params.set('with_portfolio', 'true');
      if (filters.location) params.set('location', filters.location);
      params.set('sort', sortBy);
      
      const response = await fetch(`/api/providers/search?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
        setTotalCount(data.total || 0);
      } else {
        // Données de démonstration en cas d'erreur API
        setProviders(getDemoProviders());
        setTotalCount(getDemoProviders().length);
      }
    } catch (error) {
      console.error('Erreur chargement prestataires:', error);
      setProviders(getDemoProviders());
      setTotalCount(getDemoProviders().length);
    } finally {
      setLoading(false);
    }
  };
  
  const handleServiceToggle = (service: ServiceType) => {
    setFilters(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service],
    }));
  };
  
  const clearFilters = () => {
    setFilters(defaultFilters);
    setSearchQuery('');
  };
  
  const activeFiltersCount = 
    filters.services.length + 
    (filters.minRating > 0 ? 1 : 0) + 
    (filters.maxPrice < 200 ? 1 : 0) + 
    (filters.urgentOnly ? 1 : 0) +
    (filters.verifiedOnly ? 1 : 0) +
    (filters.withPortfolio ? 1 : 0);
  
  const handleRequestQuote = (providerId: string) => {
    router.push(`/app/owner/tickets/new?provider=${providerId}`);
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trouver un prestataire</h1>
          <p className="text-muted-foreground">
            {totalCount} prestataires disponibles dans votre zone
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Barre de recherche et filtres */}
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un prestataire, un métier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Pertinence</SelectItem>
              <SelectItem value="rating">Meilleures notes</SelectItem>
              <SelectItem value="reviews">Plus d'avis</SelectItem>
              <SelectItem value="price_asc">Prix croissant</SelectItem>
              <SelectItem value="price_desc">Prix décroissant</SelectItem>
              <SelectItem value="distance">Distance</SelectItem>
            </SelectContent>
          </Select>
          
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="relative">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filtres
                {activeFiltersCount > 0 && (
                  <Badge className="ml-2 h-5 w-5 p-0 justify-center">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filtres</SheetTitle>
                <SheetDescription>
                  Affinez votre recherche de prestataires
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {/* Métiers */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Métiers</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(SERVICE_TYPE_LABELS).slice(0, 10).map(([key, label]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox
                          id={key}
                          checked={filters.services.includes(key as ServiceType)}
                          onCheckedChange={() => handleServiceToggle(key as ServiceType)}
                        />
                        <Label htmlFor={key} className="text-sm cursor-pointer">
                          {label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Note minimum */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Note minimum</Label>
                    <span className="text-sm text-muted-foreground">
                      {filters.minRating > 0 ? `${filters.minRating}+ ⭐` : 'Toutes'}
                    </span>
                  </div>
                  <Slider
                    value={[filters.minRating]}
                    onValueChange={([value]) => setFilters(prev => ({ ...prev, minRating: value }))}
                    max={5}
                    step={0.5}
                  />
                </div>
                
                {/* Prix max */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-medium">Prix max/heure</Label>
                    <span className="text-sm text-muted-foreground">
                      {filters.maxPrice < 200 ? `${filters.maxPrice}€` : 'Tous'}
                    </span>
                  </div>
                  <Slider
                    value={[filters.maxPrice]}
                    onValueChange={([value]) => setFilters(prev => ({ ...prev, maxPrice: value }))}
                    min={20}
                    max={200}
                    step={10}
                  />
                </div>
                
                {/* Options */}
                <div className="space-y-3">
                  <Label className="text-base font-medium">Options</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="urgent"
                        checked={filters.urgentOnly}
                        onCheckedChange={(checked) => 
                          setFilters(prev => ({ ...prev, urgentOnly: !!checked }))
                        }
                      />
                      <Label htmlFor="urgent" className="text-sm cursor-pointer flex items-center gap-1">
                        <Zap className="h-4 w-4 text-red-500" />
                        Disponible en urgence
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="verified"
                        checked={filters.verifiedOnly}
                        onCheckedChange={(checked) => 
                          setFilters(prev => ({ ...prev, verifiedOnly: !!checked }))
                        }
                      />
                      <Label htmlFor="verified" className="text-sm cursor-pointer">
                        Prestataires vérifiés uniquement
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="portfolio"
                        checked={filters.withPortfolio}
                        onCheckedChange={(checked) => 
                          setFilters(prev => ({ ...prev, withPortfolio: !!checked }))
                        }
                      />
                      <Label htmlFor="portfolio" className="text-sm cursor-pointer">
                        Avec photos de réalisations
                      </Label>
                    </div>
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={clearFilters}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Réinitialiser
                  </Button>
                  <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                    Appliquer
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      
      {/* Filtres actifs */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.services.map(service => (
            <Badge key={service} variant="secondary" className="gap-1">
              {SERVICE_TYPE_LABELS[service]}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => handleServiceToggle(service)}
              />
            </Badge>
          ))}
          {filters.minRating > 0 && (
            <Badge variant="secondary" className="gap-1">
              {filters.minRating}+ ⭐
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setFilters(prev => ({ ...prev, minRating: 0 }))}
              />
            </Badge>
          )}
          {filters.urgentOnly && (
            <Badge variant="secondary" className="gap-1">
              <Zap className="h-3 w-3" /> Urgence
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => setFilters(prev => ({ ...prev, urgentOnly: false }))}
              />
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Tout effacer
          </Button>
        </div>
      )}
      
      {/* Liste des prestataires */}
      {loading ? (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
          : 'space-y-3'
        }>
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : providers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Aucun prestataire trouvé</h3>
            <p className="text-muted-foreground mt-1">
              Essayez de modifier vos critères de recherche
            </p>
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              Réinitialiser les filtres
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map(provider => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onRequestQuote={handleRequestQuote}
              onToggleFavorite={(id) => console.log('Toggle favorite:', id)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map(provider => (
            <ProviderCardCompact
              key={provider.id}
              provider={provider}
              onRequestQuote={handleRequestQuote}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Données de démonstration
function getDemoProviders(): ProviderCardData[] {
  return [
    {
      id: '1',
      name: 'Jean Dupont',
      services: ['plomberie', 'chauffage_clim'],
      rating: 4.8,
      review_count: 67,
      intervention_count: 120,
      location: 'Paris 11e',
      distance_km: 2.3,
      hourly_rate_min: 45,
      hourly_rate_max: 65,
      is_urgent_available: true,
      response_time_hours: 1.5,
      kyc_status: 'verified',
      has_certifications: true,
      portfolio_count: 12,
      featured_portfolio: {
        before_url: 'https://placehold.co/400x300/e2e8f0/64748b?text=Avant',
        after_url: 'https://placehold.co/400x300/dcfce7/16a34a?text=Après',
        title: 'Rénovation salle de bain complète',
      },
    },
    {
      id: '2',
      name: 'Marie Martin',
      services: ['electricite', 'domotique'],
      rating: 4.9,
      review_count: 103,
      intervention_count: 180,
      location: 'Paris 12e',
      distance_km: 3.1,
      hourly_rate_min: 50,
      hourly_rate_max: 70,
      is_urgent_available: true,
      response_time_hours: 0.8,
      kyc_status: 'verified',
      has_certifications: true,
      portfolio_count: 24,
    },
    {
      id: '3',
      name: 'Pierre Bernard',
      services: ['peinture', 'menuiserie'],
      rating: 4.6,
      review_count: 45,
      intervention_count: 78,
      location: 'Paris 20e',
      distance_km: 4.5,
      hourly_rate_min: 35,
      hourly_rate_max: 50,
      is_urgent_available: false,
      response_time_hours: 3,
      kyc_status: 'verified',
      has_certifications: false,
      portfolio_count: 8,
    },
    {
      id: '4',
      name: 'Sophie Durand',
      services: ['nettoyage'],
      rating: 4.7,
      review_count: 32,
      intervention_count: 55,
      location: 'Paris 19e',
      distance_km: 5.2,
      hourly_rate_min: 25,
      hourly_rate_max: 35,
      is_urgent_available: true,
      response_time_hours: 2,
      kyc_status: 'verified',
      has_certifications: false,
      portfolio_count: 5,
    },
    {
      id: '5',
      name: 'Lucas Petit',
      services: ['serrurerie'],
      rating: 4.4,
      review_count: 18,
      intervention_count: 30,
      location: 'Paris 10e',
      distance_km: 1.8,
      hourly_rate_min: 55,
      hourly_rate_max: 80,
      is_urgent_available: true,
      response_time_hours: 0.5,
      kyc_status: 'pending_review',
      has_certifications: false,
      portfolio_count: 0,
    },
    {
      id: '6',
      name: 'Emma Leroy',
      services: ['jardinage'],
      rating: 4.5,
      review_count: 3,
      intervention_count: 4,
      location: 'Paris 16e',
      distance_km: 6.7,
      hourly_rate_min: 30,
      hourly_rate_max: 40,
      is_urgent_available: false,
      response_time_hours: 24,
      kyc_status: 'verified',
      has_certifications: false,
      portfolio_count: 2,
    },
  ];
}

