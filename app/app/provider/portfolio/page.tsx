'use client';

// =====================================================
// Page Portfolio Prestataire
// Gestion des réalisations avant/après
// =====================================================

import { useState, useEffect } from 'react';
import { 
  Plus, 
  ImageIcon, 
  Star, 
  Trash2, 
  Edit, 
  Eye,
  EyeOff,
  MoreVertical,
  Upload,
  CheckCircle,
  Clock,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { SERVICE_TYPE_LABELS, type ServiceType } from '@/lib/data/service-pricing-reference';
import Image from 'next/image';

interface PortfolioItem {
  id: string;
  title: string;
  description?: string;
  service_type: string;
  before_photo_url?: string;
  after_photo_url: string;
  location_city?: string;
  completed_at?: string;
  is_public: boolean;
  is_featured: boolean;
  moderation_status: 'pending' | 'approved' | 'rejected';
  view_count: number;
  created_at: string;
}

export default function ProviderPortfolioPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<PortfolioItem | null>(null);
  const [editItem, setEditItem] = useState<PortfolioItem | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    service_type: '' as ServiceType | '',
    before_photo_url: '',
    after_photo_url: '',
    location_city: '',
    completed_at: '',
    is_public: true,
    is_featured: false,
  });
  const [submitting, setSubmitting] = useState(false);
  
  useEffect(() => {
    fetchPortfolio();
  }, []);
  
  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/provider/portfolio');
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Erreur chargement portfolio:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = async () => {
    if (!formData.title || !formData.after_photo_url || !formData.service_type) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs obligatoires',
        variant: 'destructive',
      });
      return;
    }
    
    setSubmitting(true);
    try {
      const url = editItem 
        ? `/api/provider/portfolio/${editItem.id}` 
        : '/api/provider/portfolio';
      const method = editItem ? 'PATCH' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (response.ok) {
        toast({
          title: editItem ? 'Réalisation modifiée' : 'Réalisation ajoutée',
          description: editItem 
            ? 'Vos modifications ont été enregistrées'
            : 'Votre réalisation sera visible après modération',
        });
        setIsAddDialogOpen(false);
        setEditItem(null);
        resetForm();
        fetchPortfolio();
      } else {
        const data = await response.json();
        toast({
          title: 'Erreur',
          description: data.error || 'Une erreur est survenue',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Erreur soumission:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleDelete = async () => {
    if (!deleteItem) return;
    
    try {
      const response = await fetch(`/api/provider/portfolio/${deleteItem.id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        toast({
          title: 'Réalisation supprimée',
          description: 'La réalisation a été supprimée de votre portfolio',
        });
        setDeleteItem(null);
        fetchPortfolio();
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer',
        variant: 'destructive',
      });
    }
  };
  
  const handleToggleFeatured = async (item: PortfolioItem) => {
    const featuredCount = items.filter(i => i.is_featured && i.id !== item.id).length;
    
    if (!item.is_featured && featuredCount >= 3) {
      toast({
        title: 'Limite atteinte',
        description: 'Vous ne pouvez mettre en vedette que 3 réalisations maximum',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/provider/portfolio/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_featured: !item.is_featured }),
      });
      
      if (response.ok) {
        toast({
          title: item.is_featured ? 'Retiré des vedettes' : 'Mis en vedette',
        });
        fetchPortfolio();
      }
    } catch (error) {
      console.error('Erreur toggle featured:', error);
    }
  };
  
  const handleToggleVisibility = async (item: PortfolioItem) => {
    try {
      const response = await fetch(`/api/provider/portfolio/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: !item.is_public }),
      });
      
      if (response.ok) {
        toast({
          title: item.is_public ? 'Masqué' : 'Visible',
          description: item.is_public 
            ? 'Cette réalisation n\'est plus visible publiquement'
            : 'Cette réalisation est maintenant visible',
        });
        fetchPortfolio();
      }
    } catch (error) {
      console.error('Erreur toggle visibility:', error);
    }
  };
  
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      service_type: '',
      before_photo_url: '',
      after_photo_url: '',
      location_city: '',
      completed_at: '',
      is_public: true,
      is_featured: false,
    });
  };
  
  const openEditDialog = (item: PortfolioItem) => {
    setEditItem(item);
    setFormData({
      title: item.title,
      description: item.description || '',
      service_type: item.service_type as ServiceType,
      before_photo_url: item.before_photo_url || '',
      after_photo_url: item.after_photo_url,
      location_city: item.location_city || '',
      completed_at: item.completed_at || '',
      is_public: item.is_public,
      is_featured: item.is_featured,
    });
    setIsAddDialogOpen(true);
  };
  
  const featuredCount = items.filter(i => i.is_featured).length;
  const pendingCount = items.filter(i => i.moderation_status === 'pending').length;
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Approuvé</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />En attente</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Refusé</Badge>;
      default:
        return null;
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mon Portfolio</h1>
          <p className="text-muted-foreground">
            Présentez vos meilleures réalisations aux propriétaires
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setEditItem(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une réalisation
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editItem ? 'Modifier la réalisation' : 'Nouvelle réalisation'}
              </DialogTitle>
              <DialogDescription>
                Ajoutez des photos avant/après pour montrer votre travail
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titre *</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Rénovation salle de bain"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="service_type">Type de service *</Label>
                  <Select
                    value={formData.service_type}
                    onValueChange={(v) => setFormData({ ...formData, service_type: v as ServiceType })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Décrivez les travaux réalisés..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="before_photo">Photo AVANT (URL)</Label>
                  <Input
                    id="before_photo"
                    type="url"
                    placeholder="https://..."
                    value={formData.before_photo_url}
                    onChange={(e) => setFormData({ ...formData, before_photo_url: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="after_photo">Photo APRÈS (URL) *</Label>
                  <Input
                    id="after_photo"
                    type="url"
                    placeholder="https://..."
                    value={formData.after_photo_url}
                    onChange={(e) => setFormData({ ...formData, after_photo_url: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Ville</Label>
                  <Input
                    id="location"
                    placeholder="Ex: Paris"
                    value={formData.location_city}
                    onChange={(e) => setFormData({ ...formData, location_city: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="date">Date de réalisation</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.completed_at}
                    onChange={(e) => setFormData({ ...formData, completed_at: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_public"
                    checked={formData.is_public}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })}
                  />
                  <Label htmlFor="is_public">Visible publiquement</Label>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_featured"
                    checked={formData.is_featured}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                    disabled={!formData.is_featured && featuredCount >= 3}
                  />
                  <Label htmlFor="is_featured">Mettre en vedette</Label>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Annuler
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Enregistrement...' : (editItem ? 'Modifier' : 'Ajouter')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{items.length}</div>
            <p className="text-sm text-muted-foreground">Réalisations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-amber-600">{featuredCount}/3</div>
            <p className="text-sm text-muted-foreground">En vedette</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {items.reduce((sum, i) => sum + i.view_count, 0)}
            </div>
            <p className="text-sm text-muted-foreground">Vues totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
            <p className="text-sm text-muted-foreground">En attente de modération</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Liste des réalisations */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <Skeleton className="h-48 w-full" />
              <CardContent className="pt-4">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Aucune réalisation</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              Ajoutez vos premières photos avant/après pour montrer votre travail
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une réalisation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <Card key={item.id} className="overflow-hidden group">
              <div className="relative aspect-[4/3] bg-gray-100">
                {item.before_photo_url ? (
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
                ) : (
                  <Image
                    src={item.after_photo_url}
                    alt={item.title}
                    fill
                    className="object-cover"
                  />
                )}
                
                {/* Badges overlay */}
                <div className="absolute top-2 left-2 flex gap-1">
                  {item.is_featured && (
                    <Badge className="bg-amber-500">
                      <Star className="h-3 w-3 mr-1" />
                      Vedette
                    </Badge>
                  )}
                  {!item.is_public && (
                    <Badge variant="secondary">
                      <EyeOff className="h-3 w-3 mr-1" />
                      Masqué
                    </Badge>
                  )}
                </div>
                
                {/* Menu */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(item)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleFeatured(item)}>
                        <Star className={`h-4 w-4 mr-2 ${item.is_featured ? 'fill-amber-400 text-amber-400' : ''}`} />
                        {item.is_featured ? 'Retirer des vedettes' : 'Mettre en vedette'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleVisibility(item)}>
                        {item.is_public ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Masquer
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Rendre visible
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => setDeleteItem(item)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium truncate">{item.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {SERVICE_TYPE_LABELS[item.service_type as keyof typeof SERVICE_TYPE_LABELS] || item.service_type}
                      </Badge>
                      {item.view_count > 0 && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {item.view_count}
                        </span>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(item.moderation_status)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette réalisation ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La réalisation sera définitivement supprimée de votre portfolio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

