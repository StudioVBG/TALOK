"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Users, CheckCircle2, XCircle, Building2 } from "lucide-react";

interface QuorumGaugeProps {
  totalTantiemes: number;
  presentTantiemes: number;
  quorumRequired: number;
  quorumReached: boolean;
  siteName: string;
}

export function QuorumGauge({
  totalTantiemes,
  presentTantiemes,
  quorumRequired,
  quorumReached,
  siteName,
}: QuorumGaugeProps) {
  const percent = totalTantiemes > 0 ? (presentTantiemes / totalTantiemes) * 100 : 0;
  const quorumPercent = totalTantiemes > 0 ? (quorumRequired / totalTantiemes) * 100 : 0;

  const gaugeColor = quorumReached ? "bg-emerald-500" : "bg-amber-500";
  const textColor = quorumReached ? "text-emerald-300" : "text-amber-300";

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-violet-400" />
            <h3 className="text-white font-semibold">{siteName}</h3>
          </div>
          <div className={`flex items-center gap-1 text-sm font-semibold ${textColor}`}>
            {quorumReached ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Quorum atteint
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Quorum non atteint
              </>
            )}
          </div>
        </div>

        {/* Gauge bar */}
        <div className="relative">
          <div className="h-8 bg-white/5 rounded-full overflow-hidden border border-white/10">
            <div
              className={`h-full ${gaugeColor} transition-all duration-500`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          {/* Quorum threshold marker */}
          {quorumRequired > 0 && (
            <div
              className="absolute top-0 h-8 w-0.5 bg-amber-400"
              style={{ left: `${Math.min(quorumPercent, 100)}%` }}
              title={`Quorum requis : ${quorumRequired.toLocaleString("fr-FR")} tant. (${quorumPercent.toFixed(1)}%)`}
            >
              <div className="absolute top-8 -translate-x-1/2 text-[9px] text-amber-300 whitespace-nowrap">
                Quorum ({quorumRequired.toLocaleString("fr-FR")})
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          <div>
            <p className="text-xs text-slate-400 uppercase">Tantièmes totaux</p>
            <p className="text-2xl font-bold text-white">{totalTantiemes.toLocaleString("fr-FR")}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase">Présents / représentés</p>
            <p className={`text-2xl font-bold ${textColor}`}>
              {presentTantiemes.toLocaleString("fr-FR")}
            </p>
            <p className="text-xs text-slate-500">{percent.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 uppercase">Quorum requis</p>
            <p className="text-2xl font-bold text-amber-300">
              {quorumRequired > 0 ? quorumRequired.toLocaleString("fr-FR") : "Aucun"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
