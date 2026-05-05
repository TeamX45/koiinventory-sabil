import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground/60 selection:bg-primary selection:text-primary-foreground",
        "flex field-sizing-content min-h-16 w-full rounded-xl border border-border/60 bg-background/50 px-3.5 py-2.5 text-base shadow-sm transition-all duration-200 outline-none md:text-sm",
        "hover:border-border hover:bg-background/80",
        "focus-visible:border-primary/50 focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-primary/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive/50 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
