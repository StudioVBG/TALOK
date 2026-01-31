"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calendar,
  Plus,
  Search,
  Users,
  MapPin,
  Clock,
  FileText,
  Video,
  CheckCircle2,
  XCircle,
  Edit,
  Eye,
  Send,
  Building2
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDateShort } from "@/lib/helpers/format";
import Link from "next/link";

interface Assembly {
  id: string;
  site_id: string;
  site_name: string;
  type: "ordinaire" | "extraordinaire";
  title: string;
  date: string;
  time: string;
  location: string;
  video_link?: string;
  status: "draft" | "convened" | "ongoing" | "completed" | "cancelled";
  quorum_required: number;
  attendees_count: number;
  agenda: AgendaItem[];
  created_at: string;
}

interface AgendaItem {
  id: string;
  order: number;
  title: string;
  description?: string;
  type: "information" | "vote_simple" | "vote_qualifie" | "vote_unanime";
  result?: "approved" | "rejected" | "deferred";
}

interface Site {
  id: string;
  name: string;
  units_count: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-800" },
  convened: { label: "Convoquée", color: "bg-blue-100 text-blue-800" },
  ongoing: { label: "En cours", color: "bg-amber-100 text-amber-800" },
  completed: { label: "Terminée", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Annulée", color: "bg-red-100 text-red-800" },
};

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  ordinaire: { label: "AG Ordinaire", color: "bg-cyan-100 text-cyan-800" },
  extraordinaire: { label: "AG Extraordinaire", color: "bg-violet-100 text-violet-800" },
};

export default function SyndicAssembliesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [newAssembly, setNewAssembly] = useState({
    site_id: "",
    type: "ordinaire" as Assembly["type"],
    title: "",
    date: "",
    time: "18:00",
    location: "",
    video_link: "",
    agenda: [] as { title: string; type: string }[],
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Simuler les données
      const mockAssemblies: Assembly[] = [
        {
          id: "1",
          site_id: "1",
          site_name: "Résidence Les Lilas",
          type: "ordinaire",
          title: "AG Annuelle 2025",
          date: "2025-03-15",
          time: "18:00",
          location: "Salle polyvalente, 12 rue des Lilas",
          status: "convened",
          quorum_required: 25,
          attendees_count: 0,
          agenda: [
            { id: "1", order: 1, title: "Approbation des comptes 2024", type: "vote_simple" },
            { id: "2", order: 2, title: "Budget prévisionnel 2025", type: "vote_simple" },
            { id: "3", order: 3, title: "Travaux de ravalement", type: "vote_qualifie" },
          ],
          created_at: "2025-01-15",
        },
        {
          id: "2",
          site_id: "2",
          site_name: "Le Clos des Vignes",
          type: "extraordinaire",
          title: "AG Travaux urgents",
          date: "2025-02-01",
          time: "14:00",
          location: "En visioconférence",
          video_link: "https://meet.example.com/abc123",
          status: "completed",
          quorum_required: 33,
          attendees_count: 42,
          agenda: [
            { id: "1", order: 1, title: "Réparation toiture suite tempête", type: "vote_simple", result: "approved" },
          ],
          created_at: "2025-01-10",
        },
      ];

      const mockSites: Site[] = [
        { id: "1", name: "Résidence Les Lilas", units_count: 48 },
        { id: "2", name: "Le Clos des Vignes", units_count: 32 },
        { id: "3", name: "Villa Marina", units_count: 24 },
      ];

      setAssemblies(mockAssemblies);
      setSites(mockSites);
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssembly = async () => {
    if (!newAssembly.site_id || !newAssembly.title || !newAssembly.date) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    try {
      const site = sites.find(s => s.id === newAssembly.site_id);
      const assembly: Assembly = {
        id: Date.now().toString(),
        site_id: newAssembly.site_id,
        site_name: site?.name || "",
        type: newAssembly.type,
        title: newAssembly.title,
        date: newAssembly.date,
        time: newAssembly.time,
        location: newAssembly.location,
        video_link: newAssembly.video_link,
        status: "draft",
        quorum_required: newAssembly.type === "ordinaire" ? 25 : 33,
        attendees_count: 0,
        agenda: newAssembly.agenda.map((item, index) => ({
          id: `${index}`,
          order: index + 1,
          title: item.title,
          type: item.type as AgendaItem["type"],
        })),
        created_at: new Date().toISOString(),
      };

      setAssemblies([assembly, ...assemblies]);
      toast({
        title: "AG créée",
        description: "L'assemblée générale a été créée avec succès",
      });

      setDialogOpen(false);
      setNewAssembly({
        site_id: "",
        type: "ordinaire",
        title: "",
        date: "",
        time: "18:00",
        location: "",
        video_link: "",
        agenda: [],
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'assemblée",
        variant: "destructive",
      });
    }
  };

  const handleConvoke = async (assemblyId: string) => {
    setAssemblies(assemblies.map(a => 
      a.id === assemblyId ? { ...a, status: "convened" as const } : a
    ));
    toast({
      title: "Convocations envoyées",
      description: "Tous les copropriétaires ont été notifiés",
    });
  };

  const addAgendaItem = () => {
    setNewAssembly({
      ...newAssembly,
      agenda: [...newAssembly.agenda, { title: "", type: "vote_simple" }],
    });
  };

  const filteredAssemblies = assemblies.filter(assembly => {
    const matchesSearch = 
      assembly.title.toLowerCase().includes(search.toLowerCase()) ||
      assembly.site_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || assembly.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 min-h-screen">
        <Skeleton className="h-10 w-48 bg-white/10" />
        <Skeleton className="h-96 bg-white/10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="h-6 w-6 text-violet-400" />
              Assemblées Générales
            </h1>
            <p className="text-slate-400">
              Gérez les AG de vos copropriétés
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-violet-500 to-purple-600">
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle AG
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Planifier une Assemblée Générale</DialogTitle>
                <DialogDescription>
                  Créez une nouvelle AG pour une de vos copropriétés
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Copropriété *</Label>
                    <Select
                      value={newAssembly.site_id}
                      onValueChange={(v) => setNewAssembly({ ...newAssembly, site_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {sites.map(site => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Type *</Label>
                    <Select
                      value={newAssembly.type}
                      onValueChange={(v) => setNewAssembly({ ...newAssembly, type: v as Assembly["type"] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ordinaire">AG Ordinaire</SelectItem>
                        <SelectItem value="extraordinaire">AG Extraordinaire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Titre de l'AG *</Label>
                  <Input
                    value={newAssembly.title}
                    onChange={(e) => setNewAssembly({ ...newAssembly, title: e.target.value })}
                    placeholder="Ex: AG Annuelle 2025"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={newAssembly.date}
                      onChange={(e) => setNewAssembly({ ...newAssembly, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Heure</Label>
                    <Input
                      type="time"
                      value={newAssembly.time}
                      onChange={(e) => setNewAssembly({ ...newAssembly, time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Lieu</Label>
                  <Input
                    value={newAssembly.location}
                    onChange={(e) => setNewAssembly({ ...newAssembly, location: e.target.value })}
                    placeholder="Adresse ou 'En visioconférence'"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Lien visioconférence (optionnel)</Label>
                  <Input
                    value={newAssembly.video_link}
                    onChange={(e) => setNewAssembly({ ...newAssembly, video_link: e.target.value })}
                    placeholder="https://..."
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Ordre du jour</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addAgendaItem}>
                      <Plus className="h-3 w-3 mr-1" />
                      Ajouter
                    </Button>
                  </div>
                  {newAssembly.agenda.map((item, index) => (
                    <div key={index} className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Input
                          placeholder={`Résolution ${index + 1}`}
                          value={item.title}
                          onChange={(e) => {
                            const agenda = [...newAssembly.agenda];
                            agenda[index].title = e.target.value;
                            setNewAssembly({ ...newAssembly, agenda });
                          }}
                        />
                      </div>
                      <Select
                        value={item.type}
                        onValueChange={(v) => {
                          const agenda = [...newAssembly.agenda];
                          agenda[index].type = v;
                          setNewAssembly({ ...newAssembly, agenda });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="information">Information</SelectItem>
                          <SelectItem value="vote_simple">Vote simple</SelectItem>
                          <SelectItem value="vote_qualifie">Vote qualifié</SelectItem>
                          <SelectItem value="vote_unanime">Vote unanime</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
                <Button onClick={handleCreateAssembly}>
                  Créer l'AG
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>

        {/* Assemblies list */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-white/10 bg-white/5">
            <CardContent className="p-0">
              {filteredAssemblies.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 mx-auto text-slate-500 mb-4" />
                  <p className="text-slate-400">Aucune assemblée générale</p>
                </div>
              ) : (
                <>
                  {/* Mobile card view */}
                  <div className="md:hidden space-y-3">
                    {filteredAssemblies.map((assembly) => (
                      <div key={assembly.id} className="rounded-lg border border-white/10 bg-slate-800/30 p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-white font-medium">{assembly.title}</p>
                            <p className="text-sm text-slate-400">{assembly.agenda.length} résolution(s)</p>
                          </div>
                          <Badge className={STATUS_CONFIG[assembly.status].color}>{STATUS_CONFIG[assembly.status].label}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2 text-slate-300"><Building2 className="h-4 w-4 text-slate-500" />{assembly.site_name}</div>
                          <div className="flex items-center gap-2 text-slate-300"><Clock className="h-4 w-4 text-slate-500" />{formatDateShort(assembly.date)} à {assembly.time}</div>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-white/10">
                          <Badge className={TYPE_CONFIG[assembly.type].color}>{TYPE_CONFIG[assembly.type].label}</Badge>
                          <div className="flex items-center gap-1">
                            {assembly.status === "draft" && <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" onClick={() => handleConvoke(assembly.id)}><Send className="h-4 w-4" /></Button>}
                            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white"><Eye className="h-4 w-4" /></Button>
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
                          <TableHead className="text-slate-400">AG</TableHead>
                          <TableHead className="text-slate-400">Copropriété</TableHead>
                          <TableHead className="text-slate-400">Date</TableHead>
                          <TableHead className="text-slate-400">Type</TableHead>
                          <TableHead className="text-slate-400">Statut</TableHead>
                          <TableHead className="text-slate-400 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAssemblies.map((assembly) => (
                          <TableRow key={assembly.id} className="border-white/10">
                            <TableCell>
                              <div className="text-white font-medium">{assembly.title}</div>
                              <div className="text-sm text-slate-400">
                                {assembly.agenda.length} résolution(s)
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-300">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-slate-500" />
                                {assembly.site_name}
                              </div>
                            </TableCell>
                            <TableCell className="text-slate-300">
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-slate-500" />
                                {formatDateShort(assembly.date)} à {assembly.time}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={TYPE_CONFIG[assembly.type].color}>
                                {TYPE_CONFIG[assembly.type].label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={STATUS_CONFIG[assembly.status].color}>
                                {STATUS_CONFIG[assembly.status].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {assembly.status === "draft" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-slate-400 hover:text-white"
                                    onClick={() => handleConvoke(assembly.id)}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-slate-400 hover:text-white"
                                >
                                  <Eye className="h-4 w-4" />
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
      </div>
    </div>
  );
}

