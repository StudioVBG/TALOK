"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ArrowRight, Loader2, Plus, X, SkipForward } from "lucide-react";

interface TeamMember {
  email: string;
  role: string;
}

export default function AgencyTeamOnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([{ email: "", role: "gestionnaire" }]);

  const addMember = () => {
    if (members.length < 10) {
      setMembers((prev) => [...prev, { email: "", role: "gestionnaire" }]);
    }
  };

  const removeMember = (index: number) => {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof TeamMember, value: string) => {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const validMembers = members.filter((m) => m.email.trim());
      if (validMembers.length > 0) {
        await onboardingService.saveDraft("agency_team", { members: validMembers }, "agency");
      }
      await onboardingService.markStepCompleted("team", "agency");
      toast({ title: "Equipe configuree" });
      router.push("/agency/onboarding/review");
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder. Veuillez reessayer.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    await onboardingService.markStepCompleted("team", "agency");
    router.push("/agency/onboarding/review");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Votre equipe</CardTitle>
              <CardDescription>
                Invitez vos collaborateurs pour travailler ensemble. Vous pourrez en ajouter plus tard.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {members.map((member, index) => (
            <div key={index} className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label htmlFor={`email-${index}`}>Email du collaborateur</Label>
                <Input
                  id={`email-${index}`}
                  type="email"
                  value={member.email}
                  onChange={(e) => updateMember(index, "email", e.target.value)}
                  placeholder="collaborateur@agence.fr"
                />
              </div>
              <div className="w-40 space-y-2">
                <Label htmlFor={`role-${index}`}>Role</Label>
                <select
                  id={`role-${index}`}
                  value={member.role}
                  onChange={(e) => updateMember(index, "role", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="gestionnaire">Gestionnaire</option>
                  <option value="comptable">Comptable</option>
                  <option value="commercial">Commercial</option>
                  <option value="assistant">Assistant</option>
                </select>
              </div>
              {members.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeMember(index)}
                  className="flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          {members.length < 10 && (
            <Button type="button" variant="outline" onClick={addMember} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un collaborateur
            </Button>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleSkip} className="flex-1">
              <SkipForward className="h-4 w-4 mr-2" />
              Passer cette etape
            </Button>
            <Button onClick={handleSubmit} disabled={loading} className="flex-1">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Continuer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
