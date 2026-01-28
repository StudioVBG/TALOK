import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton pour un champ de formulaire
 */
export function FormFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

/**
 * Skeleton pour un textarea
 */
export function TextareaSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/**
 * Skeleton pour un formulaire simple
 */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <FormFieldSkeleton key={i} />
      ))}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

/**
 * Skeleton pour un formulaire dans une card
 */
export function FormCardSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64 mt-1" />
      </CardHeader>
      <CardContent>
        <FormSkeleton fields={fields} />
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton pour une page de formulaire complète
 */
export function FormPageSkeleton({ sections = 2 }: { sections?: number }) {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Sections */}
      {Array.from({ length: sections }).map((_, i) => (
        <FormCardSkeleton key={i} fields={i === 0 ? 4 : 3} />
      ))}

      {/* Footer actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-40" />
      </div>
    </div>
  );
}

/**
 * Skeleton pour un wizard/stepper
 */
export function WizardSkeleton({ steps = 4 }: { steps?: number }) {
  return (
    <div className="space-y-8">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: steps }).map((_, i) => (
          <div key={i} className="flex items-center">
            <Skeleton className="h-10 w-10 rounded-full" />
            {i < steps - 1 && <Skeleton className="h-1 w-12 mx-2" />}
          </div>
        ))}
      </div>

      {/* Content */}
      <FormCardSkeleton fields={4} />
    </div>
  );
}
