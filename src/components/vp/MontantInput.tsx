/**
 * Saisie de montants € tolérante et sûre.
 *
 * - Accepte virgule/point décimal, espaces (normal, insécable), symbole €.
 * - Au focus : affiche la valeur brute éditable (ex. `1234.56`).
 * - Au blur : affiche la valeur formatée FR (`1 234,56`).
 * - Distingue explicitement « vide » (`null`) de « zéro ».
 * - Ne propage jamais un montant tant que la saisie est invalide ; marque
 *   le champ `aria-invalid` avec une bordure destructive.
 * - Aligné à droite, `tabular-nums`, `inputMode="decimal"`.
 */

import { forwardRef, useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { parseMontant, formatMontantFR } from "@/lib/format/parseMontant";

type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode"
>;

export interface MontantInputProps extends NativeInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  /** Message affiché sous le champ quand la saisie est invalide. */
  invalidMessage?: string;
}

export const MontantInput = forwardRef<HTMLInputElement, MontantInputProps>(
  function MontantInput(
    {
      value,
      onChange,
      className,
      id,
      onBlur,
      onFocus,
      "aria-describedby": describedByProp,
      "aria-invalid": ariaInvalidProp,
      invalidMessage = "Montant invalide",
      ...rest
    },
    ref,
  ) {
    const autoId = useId();
    const inputId = id ?? autoId;
    const errId = `${autoId}-err`;

    const [focused, setFocused] = useState(false);
    const [text, setText] = useState<string>(() => formatMontantFR(value));
    const [invalid, setInvalid] = useState(false);

    // Synchronise l'affichage quand la valeur externe change hors focus.
    useEffect(() => {
      if (!focused) {
        setText(formatMontantFR(value));
        setInvalid(false);
      }
    }, [value, focused]);

    const describedBy =
      [describedByProp, invalid ? errId : null].filter(Boolean).join(" ") || undefined;

    return (
      <>
        <input
          ref={ref}
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          aria-invalid={invalid || ariaInvalidProp || undefined}
          aria-describedby={describedBy}
          onFocus={(e) => {
            setFocused(true);
            // Repasse en valeur brute éditable
            setText(value == null ? "" : String(value));
            // Sélectionne pour permettre une frappe rapide de remplacement
            requestAnimationFrame(() => {
              try {
                e.target.select();
              } catch {
                /* ignore */
              }
            });
            onFocus?.(e);
          }}
          onChange={(e) => {
            setText(e.target.value);
            if (invalid) setInvalid(false);
          }}
          onBlur={(e) => {
            setFocused(false);
            const res = parseMontant(text);
            if (!res.ok) {
              setInvalid(true);
            } else {
              setInvalid(false);
              if (res.value !== value) onChange(res.value);
              setText(formatMontantFR(res.value));
            }
            onBlur?.(e);
          }}
          className={cn(
            "flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm shadow-sm transition-colors",
            "text-right tabular-nums",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "placeholder:text-muted-foreground",
            invalid ? "border-destructive" : "border-input",
            className,
          )}
          {...rest}
        />
        {invalid && (
          <p id={errId} role="alert" className="text-xs text-destructive mt-1">
            {invalidMessage}
          </p>
        )}
      </>
    );
  },
);
