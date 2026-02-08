"use client";

/**
 * P2-1: Composant de comparaison EDL entrée vs sortie
 *
 * Affiche un tableau côte à côte des pièces/éléments avec leurs états
 * et calcule automatiquement les dégradations vs usure normale.
 */

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  Camera,
} from "lucide-react";

// Niveau d'état (ordre croissant de dégradation)
const CONDITION_ORDER: Record<string, number> = {
  neuf: 0,
  bon: 1,
  moyen: 2,
  mauvais: 3,
  tres_mauvais: 4,
  hors_usage: 5,
};

const CONDITION_LABELS: Record<string, string> = {
  neuf: "Neuf",
  bon: "Bon",
  moyen: "Moyen",
  mauvais: "Mauvais",
  tres_mauvais: "Très mauvais",
  hors_usage: "Hors d'usage",
};

const CONDITION_COLORS: Record<string, string> = {
  neuf: "bg-emerald-100 text-emerald-800",
  bon: "bg-green-100 text-green-800",
  moyen: "bg-amber-100 text-amber-800",
  mauvais: "bg-orange-100 text-orange-800",
  tres_mauvais: "bg-red-100 text-red-800",
  hors_usage: "bg-red-200 text-red-900",
};

interface EDLItem {
  id: string;
  room_name: string;
  category: string;
  element: string;
  condition: string;
  comment?: string | null;
  photos_count?: number;
}

interface EDLComparisonProps {
  entryItems: EDLItem[];
  exitItems: EDLItem[];
  entryDate?: string;
  exitDate?: string;
}

interface ComparisonRow {
  room: string;
  element: string;
  category: string;
  entryCondition: string | null;
  exitCondition: string | null;
  entryComment: string | null;
  exitComment: string | null;
  degradation: "none" | "normal_wear" | "degraded" | "missing";
}

export function EDLComparison({
  entryItems,
  exitItems,
  entryDate,
  exitDate,
}: EDLComparisonProps) {
  const comparison = useMemo(() => {
    const rows: ComparisonRow[] = [];
    const exitMap = new Map<string, EDLItem>();

    // Index exit items by room+element
    for (const item of exitItems) {
      const key = `${item.room_name}::${item.element}`;
      exitMap.set(key, item);
    }

    // Compare each entry item
    for (const entryItem of entryItems) {
      const key = `${entryItem.room_name}::${entryItem.element}`;
      const exitItem = exitMap.get(key);

      let degradation: ComparisonRow["degradation"] = "none";
      if (!exitItem) {
        degradation = "missing";
      } else {
        const entryLevel = CONDITION_ORDER[entryItem.condition] ?? 1;
        const exitLevel = CONDITION_ORDER[exitItem.condition] ?? 1;
        const diff = exitLevel - entryLevel;
        if (diff === 0) degradation = "none";
        else if (diff === 1) degradation = "normal_wear";
        else if (diff >= 2) degradation = "degraded";
      }

      rows.push({
        room: entryItem.room_name,
        element: entryItem.element,
        category: entryItem.category,
        entryCondition: entryItem.condition,
        exitCondition: exitItem?.condition || null,
        entryComment: entryItem.comment || null,
        exitComment: exitItem?.comment || null,
        degradation,
      });

      exitMap.delete(key);
    }

    // Items only in exit (new elements)
    for (const [, exitItem] of exitMap) {
      rows.push({
        room: exitItem.room_name,
        element: exitItem.element,
        category: exitItem.category,
        entryCondition: null,
        exitCondition: exitItem.condition,
        entryComment: null,
        exitComment: exitItem.comment || null,
        degradation: "none",
      });
    }

    return rows;
  }, [entryItems, exitItems]);

  // Group by room
  const rooms = useMemo(() => {
    const map = new Map<string, ComparisonRow[]>();
    for (const row of comparison) {
      const existing = map.get(row.room) || [];
      existing.push(row);
      map.set(row.room, existing);
    }
    return Array.from(map.entries());
  }, [comparison]);

  // Statistics
  const stats = useMemo(() => {
    const total = comparison.length;
    const ok = comparison.filter((r) => r.degradation === "none").length;
    const normalWear = comparison.filter((r) => r.degradation === "normal_wear").length;
    const degraded = comparison.filter((r) => r.degradation === "degraded").length;
    const missing = comparison.filter((r) => r.degradation === "missing").length;
    return { total, ok, normalWear, degraded, missing };
  }, [comparison]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-green-600">{stats.ok}</p>
            <p className="text-xs text-muted-foreground">Identique</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <MinusCircle className="h-6 w-6 text-amber-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-amber-600">{stats.normalWear}</p>
            <p className="text-xs text-muted-foreground">Usure normale</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <AlertTriangle className="h-6 w-6 text-red-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-red-600">{stats.degraded}</p>
            <p className="text-xs text-muted-foreground">Dégradation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Camera className="h-6 w-6 text-slate-400 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total éléments</p>
          </CardContent>
        </Card>
      </div>

      {/* Room-by-room comparison */}
      {rooms.map(([roomName, items]) => (
        <Card key={roomName}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{roomName}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium">Élément</th>
                    <th className="text-center py-2 px-2 font-medium text-blue-600">
                      Entrée {entryDate && <span className="text-xs font-normal">({entryDate})</span>}
                    </th>
                    <th className="text-center py-2 px-1 font-medium w-8"></th>
                    <th className="text-center py-2 px-2 font-medium text-purple-600">
                      Sortie {exitDate && <span className="text-xs font-normal">({exitDate})</span>}
                    </th>
                    <th className="text-center py-2 pl-4 font-medium">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <span className="font-medium">{row.element}</span>
                        {row.entryComment && (
                          <p className="text-xs text-muted-foreground mt-0.5">{row.entryComment}</p>
                        )}
                      </td>
                      <td className="text-center py-2 px-2">
                        {row.entryCondition ? (
                          <Badge className={cn("text-xs", CONDITION_COLORS[row.entryCondition])}>
                            {CONDITION_LABELS[row.entryCondition] || row.entryCondition}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-center py-2 px-1">
                        <ArrowRight className="h-4 w-4 text-muted-foreground inline" />
                      </td>
                      <td className="text-center py-2 px-2">
                        {row.exitCondition ? (
                          <Badge className={cn("text-xs", CONDITION_COLORS[row.exitCondition])}>
                            {CONDITION_LABELS[row.exitCondition] || row.exitCondition}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="text-center py-2 pl-4">
                        {row.degradation === "none" && (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-200">OK</Badge>
                        )}
                        {row.degradation === "normal_wear" && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">Usure</Badge>
                        )}
                        {row.degradation === "degraded" && (
                          <Badge className="text-xs bg-red-100 text-red-800">Dégradation</Badge>
                        )}
                        {row.degradation === "missing" && (
                          <Badge variant="outline" className="text-xs text-slate-400 border-slate-200">Non vérifié</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {comparison.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Aucun élément à comparer.</p>
          <p className="text-sm mt-1">Réalisez l'EDL de sortie pour voir la comparaison.</p>
        </div>
      )}
    </div>
  );
}
