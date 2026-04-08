"use client";

import { usePathname } from "next/navigation";
import { StepIndicator, ONBOARDING_STEPS } from "@/components/onboarding/step-indicator";
import { Building } from "lucide-react";

const STEP_PATH_MAP: Record<string, number> = {
  profile: 0,
  mandates: 1,
  team: 2,
  review: 3,
};

function resolveCurrentStep(pathname: string | null): number {
  if (!pathname) return 0;
  const segment = pathname.split("/").filter(Boolean).pop();
  return segment ? (STEP_PATH_MAP[segment] ?? 0) : 0;
}

export default function AgencyOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentStep = resolveCurrentStep(pathname);
  const steps = ONBOARDING_STEPS.agency;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="mx-auto max-w-4xl px-4 pt-8 pb-4">
        {/* Header compact */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
            <Building className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-foreground">Talok</span>
          <span className="text-sm text-muted-foreground ml-2">Configuration Agence</span>
        </div>

        {/* Step indicator global */}
        <StepIndicator
          steps={steps}
          currentStep={currentStep}
          variant="horizontal"
          showLabels
          showEstimatedTime
          estimatedMinutes={Math.max(2, (steps.length - currentStep) * 2)}
          className="mb-10"
        />
      </div>

      {/* Page content */}
      {children}
    </div>
  );
}
