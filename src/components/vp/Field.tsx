import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";

/** Champ de saisie encadré avec label + info-bulle pédagogique. */
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor} className="text-xs font-display font-medium text-foreground/80">
          {label}
        </Label>
        {hint && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground hover:text-foreground">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{hint}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {children}
    </div>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="vp-card p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Note({
  variant = "info",
  children,
}: {
  variant?: "info" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "text-xs rounded-md px-3 py-2 border",
        variant === "warning"
          ? "bg-warning/15 border-warning/40 text-foreground"
          : "bg-muted border-border text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}
