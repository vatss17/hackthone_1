import { cn } from "@/lib/utils"

/** A placeholder block. It does not animate: a still shape is enough, and nothing moves for people who prefer less motion. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("rounded-md bg-muted", className)} {...props} />
}

/** The loading state for a page whose saved work is read from this browser: three quiet bars and a spoken status. */
function LoadingBlock({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="mt-8 space-y-3">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  )
}

export { Skeleton, LoadingBlock }
