"use client";

import { Button } from "@/components/ui/button";
import { useNewProperty } from "../_store/useNewProperty";

export default function WizardFooter({
  primary, onPrimary, onBack, disabled, hint,
}: { 
  primary: string; 
  onPrimary: () => void; 
  onBack?: () => void; 
  disabled?: boolean; 
  hint?: string;
}) {
  const { prev } = useNewProperty();
  
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="pointer-events-auto mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-4">
        <div className="rounded-2xl border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
            {hint && (
              <p className="text-xs text-muted-foreground">{hint}</p>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button 
                variant="ghost" 
                onClick={onBack ?? prev}
                className="min-h-[44px] min-w-[44px]"
              >
                Précédent
              </Button>
              <Button 
                disabled={!!disabled} 
                onClick={onPrimary}
                className="min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {primary}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

