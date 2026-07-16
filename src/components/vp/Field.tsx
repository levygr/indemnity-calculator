import { Children, cloneElement, isValidElement, useId, type ReactElement } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";

interface FieldAria {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
}

/** Champ de saisie encadré avec label + info-bulle pédagogique.
 *  Câble automatiquement `id`, `aria-describedby`, `aria-invalid`, `aria-required`
 *  sur l'élément de saisie unique passé en enfant. */
export function Field({
  label,
  hint,
  htmlFor,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const autoId = useId();
  const hintId = `${autoId}-hint`;
  const errId = `${autoId}-err`;
  const fieldId = htmlFor ?? autoId;

  const describedBy = [hint ? hintId : null, error ? errId : null].filter(Boolean).join(" ") || undefined;

  // Injecte les attributs ARIA sur l'unique enfant de saisie s'il en accepte.
  let injected: React.ReactNode = children;
  const arr = Children.toArray(children);
  if (arr.length === 1 && isValidElement(arr[0])) {
    const el = arr[0] as ReactElement<FieldAria>;
    const props: FieldAria = {
      id: el.props.id ?? fieldId,
      "aria-describedby": [el.props["aria-describedby"], describedBy].filter(Boolean).join(" ") || undefined,
      "aria-invalid": error ? true : el.props["aria-invalid"],
      "aria-required": required ? true : el.props["aria-required"],
    };
    injected = cloneElement(el, props);
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={fieldId} className="text-xs font-display font-medium text-foreground/80">
          {label}
          {required && <span aria-hidden="true" className="ml-0.5 text-destructive">*</span>}
        </Label>
        {hint && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`Aide : ${label}`}
                  aria-describedby={hintId}
                  className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{hint}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {injected}
      {hint && (
        <span id={hintId} className="sr-only">
          {hint}
        </span>
      )}
      {error && (
        <p id={errId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
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
