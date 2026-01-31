// =====================================================
// Onboarding Syndic - Étape 6: Copropriétaires
// =====================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import {
  Users, ArrowRight, ArrowLeft, Sparkles, Plus,
  Mail, Trash2, Edit2, Check, X, Send, UserPlus
} from "lucide-react";

interface StoredUnit {
  id: string;
  lot_number: string;
  building_name: string;
  type: string;
}

interface Owner {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  type: 'occupant' | 'bailleur';
  unit_ids: string[];
  send_invite: boolean;
}

export default function OnboardingOwnersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [units, setUnits] = useState<StoredUnit[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Omit<Owner, 'id'>>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    type: 'occupant',
    unit_ids: [],
    send_invite: true
  });

  // Charger les données
  useEffect(() => {
    const storedUnits = localStorage.getItem('syndic_onboarding_units');
    const storedOwners = localStorage.getItem('syndic_onboarding_owners');

    if (storedUnits) {
      setUnits(JSON.parse(storedUnits));
    } else {
      router.push('/syndic/onboarding/units');
      return;
    }

    if (storedOwners) {
      setOwners(JSON.parse(storedOwners));
    }

    setLoading(false);
  }, [router]);

  // Lots sans propriétaire assigné
  const unassignedUnits = units.filter(unit => 
    !owners.some(owner => owner.unit_ids.includes(unit.id))
  );

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      type: 'occupant',
      unit_ids: [],
      send_invite: true
    });
    setEditingOwner(null);
  };

  const openAddDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const openEditDialog = (owner: Owner) => {
    setFormData({
      first_name: owner.first_name,
      last_name: owner.last_name,
      email: owner.email,
      phone: owner.phone || '',
      type: owner.type,
      unit_ids: owner.unit_ids,
      send_invite: owner.send_invite
    });
    setEditingOwner(owner);
    setShowAddDialog(true);
  };

  const handleSaveOwner = () => {
    // Validation
    if (!formData.first_name || !formData.last_name || !formData.email) {
      toast({
        title: "Champs requis",
        description: "Prénom, nom et email sont obligatoires.",
        variant: "destructive"
      });
      return;
    }

    if (formData.unit_ids.length === 0) {
      toast({
        title: "Lot requis",
        description: "Sélectionnez au moins un lot pour ce copropriétaire.",
        variant: "destructive"
      });
      return;
    }

    if (editingOwner) {
      // Update
      setOwners(prev => prev.map(o => 
        o.id === editingOwner.id 
          ? { ...formData, id: editingOwner.id }
          : o
      ));
      toast({ title: "Copropriétaire modifié" });
    } else {
      // Create
      const newOwner: Owner = {
        ...formData,
        id: `owner-${Date.now()}`
      };
      setOwners(prev => [...prev, newOwner]);
      toast({ title: "Copropriétaire ajouté" });
    }

    setShowAddDialog(false);
    resetForm();
  };

  const deleteOwner = (ownerId: string) => {
    setOwners(prev => prev.filter(o => o.id !== ownerId));
    toast({ title: "Copropriétaire supprimé" });
  };

  const toggleUnit = (unitId: string) => {
    setFormData(prev => ({
      ...prev,
      unit_ids: prev.unit_ids.includes(unitId)
        ? prev.unit_ids.filter(id => id !== unitId)
        : [...prev.unit_ids, unitId]
    }));
  };

  const handleSubmit = async () => {
    setSaving(true);

    try {
      localStorage.setItem('syndic_onboarding_owners', JSON.stringify(owners));
      router.push('/syndic/onboarding/complete');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la sauvegarde.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  // Stats
  const totalOwners = owners.length;
  const ownersToInvite = owners.filter(o => o.send_invite).length;
  const assignedUnits = units.length - unassignedUnits.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="text-xl font-bold text-white mb-2">Copropriétaires</h2>
        <p className="text-slate-400">
          Ajoutez les copropriétaires et leurs lots. Ils recevront une invitation par email.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-4"
      >
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-white">{totalOwners}</p>
            <p className="text-sm text-slate-400">Copropriétaires</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-emerald-400">{assignedUnits}/{units.length}</p>
            <p className="text-sm text-slate-400">Lots assignés</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-violet-400">{ownersToInvite}</p>
            <p className="text-sm text-slate-400">Invitations à envoyer</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Liste des copropriétaires */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-white/10 bg-white/5">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-violet-400" />
              Liste des copropriétaires
            </CardTitle>
            <Button onClick={openAddDialog} size="sm" className="bg-violet-500 hover:bg-violet-600">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
          </CardHeader>
          <CardContent>
            {owners.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aucun copropriétaire ajouté.</p>
                <p className="text-sm">Cliquez sur "Ajouter" pour commencer.</p>
              </div>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="md:hidden space-y-3">
                  {owners.map((owner) => (
                    <div key={owner.id} className="rounded-lg border border-white/10 bg-slate-800/30 p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white font-medium">{owner.first_name} {owner.last_name}</p>
                          <p className="text-sm text-slate-300">{owner.email}</p>
                        </div>
                        <Badge className={owner.type === 'occupant' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}>
                          {owner.type === 'occupant' ? 'Occupant' : 'Bailleur'}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {owner.unit_ids.map(unitId => {
                          const unit = units.find(u => u.id === unitId);
                          return unit ? <Badge key={unitId} className="bg-slate-500/20 text-slate-300 text-xs">{unit.lot_number}</Badge> : null;
                        })}
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-white/10">
                        {owner.send_invite ? <Badge className="bg-violet-500/20 text-violet-400"><Send className="w-3 h-3 mr-1" />À envoyer</Badge> : <Badge className="bg-slate-500/20 text-slate-400">Non invité</Badge>}
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEditDialog(owner)} className="h-8 w-8 text-slate-400 hover:text-white"><Edit2 className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteOwner(owner.id)} className="h-8 w-8 text-red-400 hover:bg-red-500/20"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-slate-400">Nom</TableHead>
                        <TableHead className="text-slate-400">Email</TableHead>
                        <TableHead className="text-slate-400">Type</TableHead>
                        <TableHead className="text-slate-400">Lots</TableHead>
                        <TableHead className="text-slate-400">Invitation</TableHead>
                        <TableHead className="text-slate-400 w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {owners.map((owner) => (
                        <TableRow key={owner.id} className="border-white/10">
                          <TableCell className="text-white font-medium">
                            {owner.first_name} {owner.last_name}
                          </TableCell>
                          <TableCell className="text-slate-300">{owner.email}</TableCell>
                          <TableCell>
                            <Badge className={
                              owner.type === 'occupant'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-blue-500/20 text-blue-400'
                            }>
                              {owner.type === 'occupant' ? 'Occupant' : 'Bailleur'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {owner.unit_ids.map(unitId => {
                                const unit = units.find(u => u.id === unitId);
                                return unit ? (
                                  <Badge key={unitId} className="bg-slate-500/20 text-slate-300 text-xs">
                                    {unit.lot_number}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            {owner.send_invite ? (
                              <Badge className="bg-violet-500/20 text-violet-400">
                                <Send className="w-3 h-3 mr-1" />
                                À envoyer
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-500/20 text-slate-400">
                                Non
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => openEditDialog(owner)}
                                className="h-8 w-8 text-slate-400 hover:text-white"
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteOwner(owner.id)}
                                className="h-8 w-8 text-red-400 hover:bg-red-500/20"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Lots non assignés */}
      {unassignedUnits.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="text-amber-400 text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                {unassignedUnits.length} lot(s) sans propriétaire
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {unassignedUnits.map(unit => (
                <Badge key={unit.id} className="bg-amber-500/20 text-amber-400">
                  Lot {unit.lot_number} - {unit.building_name}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex justify-between pt-4"
      >
        <Button 
          variant="outline" 
          onClick={() => router.push('/syndic/onboarding/tantiemes')}
          className="border-white/10 text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={handleSubmit}
            className="border-white/10 text-white"
          >
            Passer cette étape
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={saving}
            className="bg-gradient-to-r from-violet-500 to-purple-600"
          >
            {saving ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                Sauvegarde...
              </>
            ) : (
              <>
                Terminer la configuration
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Dialog Ajouter/Modifier */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingOwner ? 'Modifier le copropriétaire' : 'Ajouter un copropriétaire'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Prénom *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Jean"
                />
              </div>
              <div>
                <Label className="text-slate-300">Nom *</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="Dupont"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="jean.dupont@email.com"
                />
              </div>
              <div>
                <Label className="text-slate-300">Téléphone</Label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                  placeholder="06 12 34 56 78"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Type de copropriétaire</Label>
              <Select 
                value={formData.type} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, type: v as 'occupant' | 'bailleur' }))}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="occupant" className="text-white focus:bg-slate-700">
                    Copropriétaire occupant
                  </SelectItem>
                  <SelectItem value="bailleur" className="text-white focus:bg-slate-700">
                    Copropriétaire bailleur
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300 mb-2 block">Lots possédés *</Label>
              <div className="max-h-48 overflow-y-auto bg-white/5 rounded-lg p-3 space-y-2">
                {units.map(unit => {
                  const isSelected = formData.unit_ids.includes(unit.id);
                  const isAssigned = owners.some(o => 
                    o.id !== editingOwner?.id && o.unit_ids.includes(unit.id)
                  );

                  return (
                    <div
                      key={unit.id}
                      onClick={() => !isAssigned && toggleUnit(unit.id)}
                      className={`
                        flex items-center justify-between p-2 rounded cursor-pointer
                        ${isAssigned ? 'opacity-50 cursor-not-allowed' : ''}
                        ${isSelected ? 'bg-violet-500/20 border border-violet-500' : 'hover:bg-white/5 border border-transparent'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={isSelected} 
                          disabled={isAssigned}
                          className="border-white/30"
                        />
                        <div>
                          <span className="text-white font-mono">Lot {unit.lot_number}</span>
                          <span className="text-slate-400 ml-2">- {unit.building_name}</span>
                        </div>
                      </div>
                      <Badge className="bg-slate-500/20 text-slate-400">
                        {unit.type === 'appartement' ? 'Appt' : unit.type}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-violet-500/10 rounded-lg">
              <Checkbox
                id="send_invite"
                checked={formData.send_invite}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, send_invite: checked as boolean }))
                }
                className="border-violet-400"
              />
              <Label htmlFor="send_invite" className="text-slate-300 cursor-pointer">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-violet-400" />
                  Envoyer une invitation par email
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Le copropriétaire recevra un email pour créer son compte et accéder à l'extranet.
                </p>
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              className="border-white/10 text-white"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveOwner}
              className="bg-violet-500 hover:bg-violet-600"
            >
              {editingOwner ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

