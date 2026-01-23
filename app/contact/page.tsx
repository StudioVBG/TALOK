"use client";

/**
 * Page Contact
 *
 * Formulaire de contact + coordonnées
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  CheckCircle,
  Building2,
  Headphones,
} from "lucide-react";
import { PublicFooter } from "@/components/layout/public-footer";

const SUBJECTS = [
  { value: "general", label: "Question générale" },
  { value: "demo", label: "Demander une démo" },
  { value: "enterprise", label: "Offre Enterprise" },
  { value: "support", label: "Support technique" },
  { value: "partnership", label: "Partenariat" },
  { value: "press", label: "Presse / Média" },
];

export default function ContactPage() {
  const searchParams = useSearchParams();
  const initialSubject = searchParams.get("subject") || "general";

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    subject: initialSubject,
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSubmitted(true);
    setIsSubmitting(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Message envoyé !</h1>
          <p className="text-slate-400 mb-6">
            Merci pour votre message. Notre équipe vous répondra dans les plus brefs délais,
            généralement sous 24h.
          </p>
          <Button onClick={() => window.location.href = "/"} variant="outline">
            Retour à l'accueil
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero */}
      <section className="relative pt-24 pb-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 mb-4">
              <MessageSquare className="w-3 h-3 mr-1" />
              Contactez-nous
            </Badge>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Une question ?{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Parlons-en
              </span>
            </h1>

            <p className="text-lg text-slate-400">
              Notre équipe est là pour vous aider. Réponse garantie sous 24h.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Contact Info */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                <Card className="bg-slate-800/30 border-slate-700/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white mb-1">Email</h3>
                        <a href="mailto:contact@talok.fr" className="text-indigo-400 hover:underline">
                          contact@talok.fr
                        </a>
                        <p className="text-sm text-slate-500 mt-1">
                          Support : support@talok.fr
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/30 border-slate-700/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <Phone className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white mb-1">Téléphone</h3>
                        <p className="text-slate-300">Métropole : 01 XX XX XX XX</p>
                        <p className="text-slate-300">Antilles : 0696 XX XX XX</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/30 border-slate-700/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white mb-1">Horaires</h3>
                        <p className="text-slate-300">Lun-Ven : 9h-18h (Paris)</p>
                        <p className="text-slate-300">Lun-Ven : 8h-17h (Antilles)</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/30 border-slate-700/50">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white mb-1">Adresse</h3>
                        <p className="text-slate-300">Fort-de-France</p>
                        <p className="text-slate-300">Martinique, France</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Contact Form */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="lg:col-span-2"
              >
                <Card className="bg-slate-800/30 border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Send className="w-5 h-5 text-indigo-400" />
                      Envoyez-nous un message
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-300">Nom complet *</Label>
                          <Input
                            required
                            value={formData.name}
                            onChange={(e) => handleChange("name", e.target.value)}
                            className="bg-slate-900/50 border-slate-700 text-white"
                            placeholder="Jean Dupont"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300">Email *</Label>
                          <Input
                            required
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleChange("email", e.target.value)}
                            className="bg-slate-900/50 border-slate-700 text-white"
                            placeholder="jean@exemple.fr"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-slate-300">Téléphone</Label>
                          <Input
                            value={formData.phone}
                            onChange={(e) => handleChange("phone", e.target.value)}
                            className="bg-slate-900/50 border-slate-700 text-white"
                            placeholder="06 XX XX XX XX"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-slate-300">Entreprise / SCI</Label>
                          <Input
                            value={formData.company}
                            onChange={(e) => handleChange("company", e.target.value)}
                            className="bg-slate-900/50 border-slate-700 text-white"
                            placeholder="Optionnel"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-slate-300">Sujet *</Label>
                        <Select value={formData.subject} onValueChange={(v) => handleChange("subject", v)}>
                          <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SUBJECTS.map((subject) => (
                              <SelectItem key={subject.value} value={subject.value}>
                                {subject.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-slate-300">Message *</Label>
                        <Textarea
                          required
                          value={formData.message}
                          onChange={(e) => handleChange("message", e.target.value)}
                          className="bg-slate-900/50 border-slate-700 text-white min-h-[150px]"
                          placeholder="Comment pouvons-nous vous aider ?"
                        />
                      </div>

                      <Button
                        type="submit"
                        size="lg"
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          "Envoi en cours..."
                        ) : (
                          <>
                            Envoyer le message
                            <Send className="w-4 h-4 ml-2" />
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter variant="dark" />
    </div>
  );
}
