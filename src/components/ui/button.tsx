import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/**
 * One button family.
 *   default  the single primary action on a screen (filled teal)
 *   outline  an ordinary action (white, visible border: clearly clickable, never looks disabled)
 *   secondary a quiet filled action
 *   ghost    toolbar and inline actions
 *   link     an inline text action
 * Sizes are 44px on phones and 40px from the medium breakpoint.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-colors duration-150 select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:border-border disabled:bg-muted disabled:text-muted-foreground aria-disabled:pointer-events-none aria-disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "border-input bg-card text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        secondary:
          "border-border bg-secondary text-secondary-foreground hover:bg-accent aria-expanded:bg-accent",
        ghost:
          "text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        destructive:
          "border-destructive/30 bg-card text-destructive hover:bg-destructive/10 focus-visible:outline-destructive",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 md:h-10",
        xs: "h-8 rounded px-2 text-xs",
        sm: "h-10 px-3 text-[13px] md:h-9",
        lg: "h-12 px-5 text-[15px] md:h-11",
        icon: "size-11 md:size-10",
        "icon-xs": "size-8 rounded",
        "icon-sm": "size-10 md:size-9",
        "icon-lg": "size-12 md:size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
