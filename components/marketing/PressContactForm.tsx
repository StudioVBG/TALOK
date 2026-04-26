"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Mail, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const INITIAL_DATA = {
  name: "",
  email: "",
  mediaOutlet: "",
  deadline: "",
  message: "",
  website: "", // honeypot
};

export function PressContactForm() {
  const [data, setData] = useState(INITIAL_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (field: keyof typeof INITIAL_DATA, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          subject: "press",
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        setErrorMessage(
          result?.error ||
            "Échec de l'envoi. Réessayez ou écrivez-nous à presse@talok.fr."
        );
        setIsSubmitting(false);
        return;
      }

      setIsSubmitted(true);
    } catch {
      setErrorMessage(
        "Impossible de contacter le serveur. Écrivez-nous à presse@talok.fr."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
          <CheckCircle className="h-7 w-7 text-emerald-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Demande envoyée
        </h3>
        <p className="text-slate-300">
          Notre équipe presse vous répondra sous 48h ouvrées. Pour les
          deadlines urgentes, écrivez à{" "}
          <a href="mailto:presse@talok.fr" className="text-emerald-300 underline">
            presse@talok.fr
          </a>
          .
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Honeypot */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        <label htmlFor="press-website">Ne remplissez pas ce champ</label>
        <input
          id="press-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={data.website}
          onChange={(e) => handleChange("website", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="press-name" className="text-slate-300">
            Nom *
          </Label>
          <Input
            id="press-name"
            required
            autoComplete="name"
            value={data.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="bg-slate-900/50 border-slate-700 text-white"
            placeholder="Camille Durand"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="press-email" className="text-slate-300">
            Email professionnel *
          </Label>
          <Input
            id="press-email"
            required
            type="email"
            autoComplete="email"
            value={data.email}
            onChange={(e) => handleChange("email", e.target.value)}
            className="bg-slate-900/50 border-slate-700 text-white"
            placeholder="camille@redaction.fr"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="press-outlet" className="text-slate-300">
            Média / Publication *
          </Label>
          <Input
            id="press-outlet"
            required
            value={data.mediaOutlet}
            onChange={(e) => handleChange("mediaOutlet", e.target.value)}
            className="bg-slate-900/50 border-slate-700 text-white"
            placeholder="Ex : Les Échos, France-Antilles…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="press-deadline" className="text-slate-300">
            Deadline (si applicable)
          </Label>
          <Input
            id="press-deadline"
            value={data.deadline}
            onChange={(e) => handleChange("deadline", e.target.value)}
            className="bg-slate-900/50 border-slate-700 text-white"
            placeholder="Ex : 30 avril 2026"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="press-message" className="text-slate-300">
          Sujet de votre demande *
        </Label>
        <Textarea
          id="press-message"
          required
          value={data.message}
          onChange={(e) => handleChange("message", e.target.value)}
          className="bg-slate-900/50 border-slate-700 text-white min-h-[140px]"
          placeholder="Quel angle vous intéresse ? Avez-vous besoin d'une interview, de visuels, de chiffres précis ?"
        />
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          {errorMessage}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:opacity-90"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Envoi en cours…
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Envoyer la demande presse
          </>
        )}
      </Button>

      <p className="text-xs text-slate-500 flex items-center gap-1.5">
        <Mail className="w-3 h-3" />
        Réponse sous 48h ouvrées · Pour l&apos;urgent : presse@talok.fr
      </p>
    </form>
  );
}
