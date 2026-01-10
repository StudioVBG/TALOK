"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Play, Clock, Video } from "lucide-react";

interface DemoVideoModalProps {
  videoUrl?: string; // URL de la vidéo à afficher (optionnel pour le moment)
}

export function DemoVideoModal({ videoUrl }: DemoVideoModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger Button */}
      <Button
        onClick={() => setIsOpen(true)}
        size="lg"
        variant="outline"
        className="h-14 px-8 text-lg font-semibold border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300"
      >
        <Play className="w-5 h-5 mr-2" />
        Voir la démo (2 min)
      </Button>

      {/* Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-white">
              <Video className="w-5 h-5 text-indigo-400" />
              Démo Talok
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Découvrez comment Talok simplifie votre gestion locative
            </DialogDescription>
          </DialogHeader>

          {videoUrl ? (
            // Affichage de la vidéo quand l'URL est fournie
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
              <iframe
                src={videoUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            // Message "Bientôt disponible" quand pas de vidéo
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
                <Clock className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Bientôt disponible
              </h3>
              <p className="text-slate-400 text-center max-w-md mb-6">
                Notre vidéo de démonstration est en cours de préparation.
                Elle sera disponible très prochainement !
              </p>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Play className="w-4 h-4" />
                <span>Durée estimée : 2 minutes</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Variante pour le HeroSection avec style différent
export function DemoVideoModalHero({ videoUrl }: DemoVideoModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="lg"
        className="h-14 px-8 text-lg font-semibold rounded-full border-2 hover:bg-muted/50 transition-all duration-300"
      >
        Voir la démo
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-white">
              <Video className="w-5 h-5 text-indigo-400" />
              Démo Talok
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Découvrez comment Talok simplifie votre gestion locative
            </DialogDescription>
          </DialogHeader>

          {videoUrl ? (
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
              <iframe
                src={videoUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
                <Clock className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Bientôt disponible
              </h3>
              <p className="text-slate-400 text-center max-w-md mb-6">
                Notre vidéo de démonstration est en cours de préparation.
                Elle sera disponible très prochainement !
              </p>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Play className="w-4 h-4" />
                <span>Durée estimée : 2 minutes</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Variante pour la page features
export function DemoVideoModalFeatures({ videoUrl }: DemoVideoModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="lg"
        variant="outline"
        className="h-14 px-8 text-lg font-semibold border-white/30 text-white hover:bg-white/10"
      >
        Voir la démo
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-white">
              <Video className="w-5 h-5 text-indigo-400" />
              Démo Talok
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Découvrez comment Talok simplifie votre gestion locative
            </DialogDescription>
          </DialogHeader>

          {videoUrl ? (
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
              <iframe
                src={videoUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 flex items-center justify-center mb-6">
                <Clock className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Bientôt disponible
              </h3>
              <p className="text-slate-400 text-center max-w-md mb-6">
                Notre vidéo de démonstration est en cours de préparation.
                Elle sera disponible très prochainement !
              </p>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Play className="w-4 h-4" />
                <span>Durée estimée : 2 minutes</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
