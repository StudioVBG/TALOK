"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Camera, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface RoomForPlan {
  id: string;
  name: string;
  type: string;
  photoCount: number;
  requiredPhotos: number;
  isComplete: boolean;
}

interface RoomPlanSelectorProps {
  rooms: RoomForPlan[];
  onRoomSelect: (roomId: string) => void;
  selectedRoomId: string | null;
  className?: string;
}

// Icônes par type de pièce
const ROOM_ICONS: Record<string, string> = {
  sejour: "🛋️",
  salon: "🛋️",
  cuisine: "🍳",
  chambre: "🛏️",
  salle_de_bain: "🚿",
  wc: "🚽",
  toilettes: "🚽",
  entree: "🚪",
  couloir: "🚶",
  balcon: "🌿",
  terrasse: "☀️",
  cave: "📦",
  garage: "🚗",
  parking: "🅿️",
  bureau: "💼",
  buanderie: "🧺",
  cellier: "🗄️",
  dressing: "👔",
  autre: "📍",
};

// Layout dynamique basé sur le nombre de pièces
function generateLayout(rooms: RoomForPlan[]): Record<string, { x: number; y: number; w: number; h: number }> {
  const layout: Record<string, { x: number; y: number; w: number; h: number }> = {};
  const count = rooms.length;
  
  // Grille adaptative
  const cols = count <= 4 ? 2 : count <= 6 ? 3 : 4;
  const cellWidth = 100 / cols;
  const cellHeight = 100 / Math.ceil(count / cols);
  
  rooms.forEach((room, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    layout[room.id] = {
      x: col * cellWidth + 1,
      y: row * cellHeight + 1,
      w: cellWidth - 2,
      h: cellHeight - 2,
    };
  });
  
  return layout;
}

export function RoomPlanSelector({
  rooms,
  onRoomSelect,
  selectedRoomId,
  className,
}: RoomPlanSelectorProps) {
  const layout = generateLayout(rooms);
  
  const totalPhotos = rooms.reduce((sum, r) => sum + r.photoCount, 0);
  const totalRequired = rooms.reduce((sum, r) => sum + r.requiredPhotos, 0);
  const completedRooms = rooms.filter((r) => r.isComplete).length;
  const globalProgress = totalRequired > 0 ? (totalPhotos / totalRequired) * 100 : 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Statistiques globales */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-1">
            <Camera className="h-3 w-3" />
            {totalPhotos} photos
          </Badge>
          <Badge 
            variant={completedRooms === rooms.length ? "default" : "secondary"}
            className={completedRooms === rooms.length ? "bg-green-500" : ""}
          >
            {completedRooms}/{rooms.length} pièces complètes
          </Badge>
        </div>
        <span className="text-muted-foreground">
          {Math.round(globalProgress)}% terminé
        </span>
      </div>

      {/* Barre de progression globale */}
      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 to-green-500"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, globalProgress)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>

      {/* Plan interactif */}
      <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-2 border-slate-200 overflow-hidden">
        {/* Grille de fond */}
        <div 
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #64748b 1px, transparent 1px),
              linear-gradient(to bottom, #64748b 1px, transparent 1px)
            `,
            backgroundSize: "25px 25px",
          }}
        />

        {/* Pièces interactives */}
        <div className="relative w-full h-full p-2">
          {rooms.map((room) => {
            const pos = layout[room.id];
            if (!pos) return null;
            
            const isSelected = room.id === selectedRoomId;
            const icon = ROOM_ICONS[room.type] || ROOM_ICONS.autre;
            const progress = room.requiredPhotos > 0 
              ? (room.photoCount / room.requiredPhotos) * 100 
              : 0;

            return (
              <motion.button
                key={room.id}
                onClick={() => onRoomSelect(room.id)}
                className={cn(
                  "absolute rounded-xl border-2 transition-all duration-200",
                  "flex flex-col items-center justify-center gap-1 p-2",
                  "hover:scale-[1.02] hover:shadow-lg hover:z-10",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  isSelected
                    ? "bg-blue-500 border-blue-600 text-white shadow-xl z-20 scale-[1.02]"
                    : room.isComplete
                    ? "bg-green-50 border-green-400 text-green-800 hover:border-green-500"
                    : room.photoCount > 0
                    ? "bg-amber-50 border-amber-300 text-amber-800 hover:border-amber-400"
                    : "bg-white border-slate-300 text-slate-700 hover:border-blue-400"
                )}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                  width: `${pos.w}%`,
                  height: `${pos.h}%`,
                }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: rooms.indexOf(room) * 0.05 }}
              >
                {/* Icône */}
                <span className="text-2xl sm:text-3xl">{icon}</span>
                
                {/* Nom */}
                <span className={cn(
                  "font-medium text-[10px] sm:text-xs truncate max-w-full text-center leading-tight",
                  isSelected && "text-white"
                )}>
                  {room.name}
                </span>

                {/* Badge photos */}
                <div className={cn(
                  "flex items-center gap-1 text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full",
                  isSelected 
                    ? "bg-white/20 text-white" 
                    : room.isComplete
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-600"
                )}>
                  <Camera className="h-2.5 w-2.5" />
                  {room.photoCount}/{room.requiredPhotos}
                </div>

                {/* Mini barre de progression */}
                {!isSelected && (
                  <div className="absolute bottom-1 left-2 right-2 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        room.isComplete ? "bg-green-500" : "bg-blue-500"
                      )}
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                )}

                {/* Check si complet */}
                {room.isComplete && !isSelected && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-md border-2 border-white">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}

                {/* Alerte si vide */}
                {room.photoCount === 0 && !isSelected && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center shadow-md border-2 border-white animate-pulse">
                    <AlertCircle className="w-3 h-3 text-white" />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Légende */}
        <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-2 text-[10px]">
          <div className="flex items-center gap-1 bg-white/90 backdrop-blur px-2 py-1 rounded-full shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            <span>Complet</span>
          </div>
          <div className="flex items-center gap-1 bg-white/90 backdrop-blur px-2 py-1 rounded-full shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>En cours</span>
          </div>
          <div className="flex items-center gap-1 bg-white/90 backdrop-blur px-2 py-1 rounded-full shadow-sm">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            <span>À faire</span>
          </div>
        </div>
      </div>
    </div>
  );
}

