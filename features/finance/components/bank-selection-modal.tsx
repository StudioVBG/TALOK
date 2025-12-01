"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ShieldCheck, Loader2, ArrowRight, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { bankConnectService } from "../services/bank-connect.service";
import { toast } from "@/components/ui/use-toast";

interface BankSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Institution {
  id: string;
  name: string;
  logo: string;
}

export function BankSelectionModal({ isOpen, onClose }: BankSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadInstitutions();
    }
  }, [isOpen]);

  const loadInstitutions = async () => {
    try {
      setLoading(true);
      const data = await bankConnectService.getInstitutions();
      setInstitutions(data);
    } catch (error) {
      console.error("Failed to load banks", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (institution: Institution) => {
    try {
      setConnectingId(institution.id);
      const response = await bankConnectService.initiateConnection(institution.id);
      
      // Redirection vers la banque
      window.location.href = response.link;
    } catch (error) {
      console.error("Connection failed", error);
      toast({
        title: "Erreur de connexion",
        description: "Impossible d'initier la connexion bancaire. Veuillez réessayer.",
        variant: "destructive",
      });
      setConnectingId(null);
    }
  };

  const filteredInstitutions = institutions.filter((inst) =>
    inst.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden gap-0 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
        <div className="p-6 bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-950 pb-4">
          <DialogHeader className="mb-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 mx-auto">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-xl font-semibold">
              Connectez votre compte
            </DialogTitle>
            <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400">
              Automatisez le suivi de vos loyers en connectant votre banque en lecture seule.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Rechercher votre banque (ex: Crédit Agricole)..."
              className="pl-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2 space-y-1 border-t border-zinc-100 dark:border-zinc-800">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
              <p className="text-sm">Chargement des banques...</p>
            </div>
          ) : filteredInstitutions.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <p>Aucune banque trouvée pour "{searchQuery}"</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredInstitutions.map((inst) => (
                <motion.button
                  key={inst.id}
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => handleConnect(inst)}
                  disabled={!!connectingId}
                  className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-10 h-10 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-1 flex items-center justify-center flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={inst.logo} alt={inst.name} className="w-8 h-8 object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 block truncate">
                      {inst.name}
                    </span>
                  </div>
                  {connectingId === inst.id ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : (
                    <ArrowRight className="w-5 h-5 text-zinc-300 group-hover:text-primary transition-colors -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100" />
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
          )}
        </div>

        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center gap-2 text-xs text-zinc-500">
          <ShieldCheck className="w-4 h-4 text-green-600" />
          <span>Connexion sécurisée & chiffrée par GoCardless (agréé ACPR)</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

