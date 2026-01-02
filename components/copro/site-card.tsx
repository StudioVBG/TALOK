// =====================================================
// Composant: Carte Site COPRO
// =====================================================

"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Building2, Users, Grid3X3, MapPin, 
  ChevronRight, Settings, MoreVertical 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import type { Site } from "@/lib/types/copro";
import { SITE_TYPE_LABELS } from "@/lib/types/copro";

interface SiteCardProps {
  site: Site & {
    buildings?: { count: number }[];
    units?: { count: number }[];
    stats?: {
      buildings_count: number;
      units_count: number;
      total_tantiemes_actual: number;
    };
  };
  showActions?: boolean;
  onEdit?: (site: Site) => void;
  onDelete?: (site: Site) => void;
}

export function SiteCard({ site, showActions = true, onEdit, onDelete }: SiteCardProps) {
  const buildingsCount = site.stats?.buildings_count || site.buildings?.[0]?.count || 0;
  const unitsCount = site.stats?.units_count || site.units?.[0]?.count || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 transition-all cursor-pointer group">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 group-hover:from-cyan-500/30 group-hover:to-blue-500/30 transition-colors">
                <Building2 className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-cyan-300 transition-colors">
                  {site.name}
                </h3>
                <Badge variant="outline" className="text-xs text-slate-400 border-slate-600">
                  {SITE_TYPE_LABELS[site.type]}
                </Badge>
              </div>
            </div>
            
            {showActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                  <DropdownMenuItem 
                    onClick={() => onEdit?.(site)}
                    className="text-slate-300 focus:text-white focus:bg-slate-700"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Paramètres
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => onDelete?.(site)}
                    className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
                  >
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Adresse */}
          <div className="flex items-start gap-2 text-slate-400 text-sm">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              {site.address_line1}
              {site.address_line2 && `, ${site.address_line2}`}
              <br />
              {site.postal_code} {site.city}
            </span>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/10">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400">
                <Building2 className="w-3.5 h-3.5" />
                <span className="text-xs">Bâtiments</span>
              </div>
              <p className="text-lg font-semibold text-white">{buildingsCount}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400">
                <Grid3X3 className="w-3.5 h-3.5" />
                <span className="text-xs">Lots</span>
              </div>
              <p className="text-lg font-semibold text-white">{unitsCount}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-slate-400">
                <Users className="w-3.5 h-3.5" />
                <span className="text-xs">Tantièmes</span>
              </div>
              <p className="text-lg font-semibold text-white">
                {site.total_tantiemes_general?.toLocaleString() || 10000}
              </p>
            </div>
          </div>
          
          {/* CTA */}
          <Link href={`/syndic/sites/${site.id}`}>
            <Button 
              variant="ghost" 
              className="w-full text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 group/btn"
            >
              Accéder à la copropriété
              <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default SiteCard;

