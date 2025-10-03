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
        // Colores corporativos
        blue: "border-transparent bg-[#010139] text-white hover:bg-[#010139]/90",
        olive: "border-transparent bg-[#8AAA19] text-white hover:bg-[#8AAA19]/90",
        success: "border-transparent bg-green-600 text-white hover:bg-green-700",
        warning: "border-transparent bg-amber-500 text-white hover:bg-amber-600",
        danger: "border-transparent bg-red-600 text-white hover:bg-red-700",
        info: "border-transparent bg-blue-500 text-white hover:bg-blue-600",
        // Variantes outline con colores corporativos
        "outline-blue": "border-2 border-[#010139] text-[#010139] bg-blue-50",
        "outline-olive": "border-2 border-[#8AAA19] text-[#8AAA19] bg-green-50",
        "outline-success": "border-2 border-green-600 text-green-700 bg-green-50",
        "outline-warning": "border-2 border-amber-500 text-amber-700 bg-amber-50",
        "outline-danger": "border-2 border-red-600 text-red-700 bg-red-50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
