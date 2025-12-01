"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Link as LinkIcon, ArrowRight, Building, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ImportStepProps {
  onImport: (url: string) => Promise<void>;
  onSkip: () => void;
  isAnalyzing: boolean;
}

export function ImportStep({ onImport, onSkip, isAnalyzing }: ImportStepProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onImport(url);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-200"
        >
          <Sparkles className="w-8 h-8 text-white" />
        </motion.div>
        <h2 className="text-3xl font-bold text-slate-900">Commençons par votre bien</h2>
        <p className="text-slate-500 text-lg">
          Avez-vous déjà une annonce en ligne (Leboncoin, SeLoger...) ?
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Option 1 : Import Magique */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="h-full"
        >
          <Card className="h-full p-6 border-2 border-indigo-100 bg-indigo-50/30 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-3">
                <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white border-0">Recommandé</Badge>
             </div>
             
             <div className="flex flex-col h-full">
                <div className="mb-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mb-3">
                        <LinkIcon className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 mb-1">Importer une annonce</h3>
                    <p className="text-sm text-slate-500">
                        Collez le lien de votre annonce et nous remplirons la fiche automatiquement.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="mt-auto space-y-3">
                    <Input 
                        placeholder="https://www.leboncoin.fr/..." 
                        className="bg-white border-indigo-200 focus-visible:ring-indigo-500"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={isAnalyzing}
                    />
                    <Button 
                        type="submit" 
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                        disabled={!url.trim() || isAnalyzing}
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Analyse en cours...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                Importer intelligemment
                            </>
                        )}
                    </Button>
                </form>
             </div>
          </Card>
        </motion.div>

        {/* Option 2 : Manuel */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="h-full"
        >
           <Card 
                className="h-full p-6 border hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer flex flex-col justify-between group"
                onClick={onSkip}
            >
                <div>
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3 group-hover:bg-slate-200 transition-colors">
                        <Building className="w-5 h-5 text-slate-600" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 mb-1">Créer manuellement</h3>
                    <p className="text-sm text-slate-500">
                        Remplissez les informations de votre bien étape par étape.
                    </p>
                </div>

                <Button variant="outline" className="w-full mt-4 group-hover:bg-white" onClick={(e) => { e.stopPropagation(); onSkip(); }}>
                    Commencer <ArrowRight className="w-4 h-4 ml-2 opacity-50 group-hover:opacity-100 transition-opacity" />
                </Button>
           </Card>
        </motion.div>
      </div>
      
      <div className="text-center text-xs text-slate-400">
         Compatible avec la plupart des sites immobiliers majeurs.
      </div>
    </div>
  );
}



