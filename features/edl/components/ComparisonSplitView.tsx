"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getConditionLabel,
  getConditionBgColor,
  getConditionColor,
} from "./ElementCotation";
import { AlertTriangle, ArrowRight, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonElement {
  item_name: string;
  element_type: string | null;
  entree: {
    condition: string | null;
    notes: string | null;
    photos: Array<{ url: string; caption?: string }>;
  } | null;
  sortie: {
    condition: string | null;
    notes: string | null;
    photos: Array<{ url: string; caption?: string }>;
    degradation_noted: boolean;
    retenue_cents: number;
    vetuste_coefficient: number | null;
  } | null;
  condition_changed: boolean;
  degradation_noted: boolean;
}

interface ComparisonRoom {
  room_name: string;
  elements: ComparisonElement[];
  has_degradations: boolean;
}

interface ComparisonSplitViewProps {
  rooms: ComparisonRoom[];
  showRetenues?: boolean;
}

export function ComparisonSplitView({
  rooms,
  showRetenues = false,
}: ComparisonSplitViewProps) {
  return (
    <div className="space-y-6">
      {rooms.map((room) => (
        <Card
          key={room.room_name}
          className={cn(
            "overflow-hidden",
            room.has_degradations && "border-orange-200"
          )}
        >
          <CardHeader className="py-3 bg-muted border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {room.room_name}
              </CardTitle>
              {room.has_degradations && (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  Dégradations
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Header row */}
            <div className="grid grid-cols-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">
              <div className="px-4 py-2 bg-blue-50/50">État d&apos;entrée</div>
              <div className="px-4 py-2 bg-orange-50/50">État de sortie</div>
            </div>

            <div className="divide-y">
              {room.elements.map((element, idx) => (
                <div key={idx} className="divide-y">
                  {/* Element name */}
                  <div className="px-4 py-2 bg-muted/30">
                    <span className="text-sm font-medium">{element.item_name}</span>
                    {element.element_type && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({element.element_type})
                      </span>
                    )}
                  </div>

                  {/* Split view */}
                  <div className="grid grid-cols-2 divide-x">
                    {/* Entrée */}
                    <div className="p-3 space-y-2">
                      {element.entree ? (
                        <>
                          <Badge
                            className={cn(
                              "text-xs",
                              getConditionBgColor(element.entree.condition),
                              getConditionColor(element.entree.condition)
                            )}
                          >
                            {getConditionLabel(element.entree.condition)}
                          </Badge>
                          {element.entree.notes && (
                            <p className="text-xs text-muted-foreground">
                              {element.entree.notes}
                            </p>
                          )}
                          {element.entree.photos.length > 0 && (
                            <div className="flex gap-1">
                              {element.entree.photos.slice(0, 3).map((photo, pIdx) => (
                                <div
                                  key={pIdx}
                                  className="w-12 h-12 rounded border bg-muted flex items-center justify-center overflow-hidden"
                                >
                                  {photo.url ? (
                                    <img
                                      src={photo.url}
                                      alt={photo.caption || "Photo entrée"}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Non documenté
                        </span>
                      )}
                    </div>

                    {/* Sortie */}
                    <div
                      className={cn(
                        "p-3 space-y-2",
                        element.degradation_noted && "bg-red-50/50"
                      )}
                    >
                      {element.sortie ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Badge
                              className={cn(
                                "text-xs",
                                getConditionBgColor(element.sortie.condition),
                                getConditionColor(element.sortie.condition)
                              )}
                            >
                              {getConditionLabel(element.sortie.condition)}
                            </Badge>
                            {element.condition_changed && (
                              <ArrowRight className="h-3 w-3 text-orange-500" />
                            )}
                            {element.degradation_noted && (
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                            )}
                          </div>
                          {element.sortie.notes && (
                            <p className="text-xs text-muted-foreground">
                              {element.sortie.notes}
                            </p>
                          )}
                          {element.sortie.photos.length > 0 && (
                            <div className="flex gap-1">
                              {element.sortie.photos
                                .slice(0, 3)
                                .map((photo, pIdx) => (
                                  <div
                                    key={pIdx}
                                    className="w-12 h-12 rounded border bg-muted flex items-center justify-center overflow-hidden"
                                  >
                                    {photo.url ? (
                                      <img
                                        src={photo.url}
                                        alt={photo.caption || "Photo sortie"}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </div>
                                ))}
                            </div>
                          )}
                          {showRetenues &&
                            element.sortie.retenue_cents > 0 && (
                              <div className="text-xs bg-red-100 text-red-700 rounded px-2 py-1 mt-1">
                                Retenue :{" "}
                                {(element.sortie.retenue_cents / 100).toFixed(2)} €
                                {element.sortie.vetuste_coefficient != null && (
                                  <span className="text-red-500 ml-1">
                                    (vétusté : {Math.round(element.sortie.vetuste_coefficient * 100)}%)
                                  </span>
                                )}
                              </div>
                            )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Non évalué
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
