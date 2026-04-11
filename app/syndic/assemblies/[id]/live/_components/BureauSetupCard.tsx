"use client";

import { useState, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Users, Loader2, AlertCircle, UserCheck } from "lucide-react";

interface Unit {
  id: string;
  lot_number: string;
  owner_profile_id: string | null;
  owner_name: string;
  tantieme_general: number;
}

interface BureauSetupCardProps {
  units: Unit[];
  totalTantiemes: number;
  onStart: (bureau: {
    presided_by: string;
    secretary_profile_id: string;
    scrutineers: Array<{ profile_id: string }>;
    present_tantiemes: number;
  }) => void | Promise<void>;
  starting: boolean;
}

export function BureauSetupCard({ units, totalTantiemes, onStart, starting }: BureauSetupCardProps) {
  const isSubmittingRef = useRef(false);
  const [presidentId, setPresidentId] = useState("");
  const [secretaryId, setSecretaryId] = useState("");
  const [scrutineerIds, setScrutineerIds] = useState<string[]>([]);
  const [presentTantiemes, setPresentTantiemes] = useState("");

  // Déduire la liste des propriétaires uniques
  const ownersOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { profile_id: string; name: string }[] = [];
    for (const unit of units) {
      if (unit.owner_profile_id && !seen.has(unit.owner_profile_id)) {
        seen.add(unit.owner_profile_id);
        options.push({ profile_id: unit.owner_profile_id, name: unit.owner_name });
      }
    }
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [units]);

  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;

    const present = parseInt(presentTantiemes, 10) || 0;
    if (present <= 0) {
      return;
    }

    isSubmittingRef.current = true;
    try {
      await onStart({
        presided_by: presidentId,
        secretary_profile_id: secretaryId,
        scrutineers: scrutineerIds.map((id) => ({ profile_id: id })),
        present_tantiemes: present,
      });
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const toggleScrutineer = (profileId: string) => {
    setScrutineerIds((prev) =>
      prev.includes(profileId) ? prev.filter((id) => id !== profileId) : [...prev, profileId]
    );
  };

  const percentPresent = totalTantiemes > 0
    ? ((parseInt(presentTantiemes, 10) || 0) / totalTantiemes * 100).toFixed(1)
    : "0";

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Users className="h-5 w-5 text-violet-400" />
          Constitution du bureau
        </CardTitle>
        <CardDescription className="text-slate-400">
          Désignez le président, le secrétaire et les scrutateurs avant de démarrer la session
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {ownersOptions.length === 0 && (
          <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            Aucun propriétaire assigné aux lots. Vous ne pourrez pas constituer le bureau tant que les lots
            n'auront pas de propriétaire.
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-slate-300">Président de séance</Label>
          <Select
            value={presidentId}
            onValueChange={setPresidentId}
            disabled={starting || ownersOptions.length === 0}
          >
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Sélectionner un copropriétaire" />
            </SelectTrigger>
            <SelectContent>
              {ownersOptions.map((owner) => (
                <SelectItem key={owner.profile_id} value={owner.profile_id}>
                  {owner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">Secrétaire de séance</Label>
          <Select
            value={secretaryId}
            onValueChange={setSecretaryId}
            disabled={starting || ownersOptions.length === 0}
          >
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Sélectionner un copropriétaire" />
            </SelectTrigger>
            <SelectContent>
              {ownersOptions.map((owner) => (
                <SelectItem key={owner.profile_id} value={owner.profile_id}>
                  {owner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">Scrutateurs (optionnel)</Label>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 max-h-48 overflow-y-auto">
            {ownersOptions.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun copropriétaire disponible</p>
            ) : (
              <div className="space-y-2">
                {ownersOptions.map((owner) => (
                  <label
                    key={owner.profile_id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={scrutineerIds.includes(owner.profile_id)}
                      onChange={() => toggleScrutineer(owner.profile_id)}
                      disabled={starting}
                      className="h-4 w-4 rounded border-white/30 bg-transparent"
                    />
                    <span className="text-sm text-white">{owner.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-300">Tantièmes présents ou représentés *</Label>
          <Input
            type="number"
            min="0"
            max={totalTantiemes}
            placeholder={`Max ${totalTantiemes.toLocaleString("fr-FR")}`}
            value={presentTantiemes}
            onChange={(e) => setPresentTantiemes(e.target.value)}
            disabled={starting}
            className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
          />
          {presentTantiemes && (
            <p className="text-xs text-slate-400">
              = {percentPresent}% du total des tantièmes
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            onClick={handleSubmit}
            disabled={
              starting ||
              !presidentId ||
              !secretaryId ||
              !presentTantiemes ||
              parseInt(presentTantiemes, 10) <= 0
            }
            className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
          >
            {starting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Démarrage...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Démarrer la session
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
