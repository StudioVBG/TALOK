import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        // WCAG AA: green-700 sur white = ratio 4.9:1
        success:
          "border-transparent bg-green-700 text-white hover:bg-green-800",
        // WCAG AA: amber-700 sur white = ratio 4.9:1
        warning:
          "border-transparent bg-amber-700 text-white hover:bg-amber-800",
        // Variante alternative avec texte foncé pour meilleur contraste
        "warning-light":
          "border-transparent bg-amber-100 text-amber-900 hover:bg-amber-200",
        "success-light":
          "border-transparent bg-green-100 text-green-900 hover:bg-green-200",
        // Info badge
        info: "border-transparent bg-blue-700 text-white hover:bg-blue-800",
        "info-light":
          "border-transparent bg-blue-100 text-blue-900 hover:bg-blue-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

