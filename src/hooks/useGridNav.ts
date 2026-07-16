/**
 * Hook de navigation clavier type Excel pour les tableaux éditables.
 *
 * Conventions :
 * - Chaque `<input>` éditable porte `data-row={index}` et `data-col={name}`.
 * - Le container passe la ref retournée à `<table>` ou `<tbody>`.
 * - Entrée dans une cellule → focus la même colonne à la ligne suivante.
 * - Tab depuis la dernière cellule éditable de la dernière ligne → appelle
 *   `onAppendRow` fourni ; au tick suivant, focus la première cellule de la
 *   nouvelle ligne.
 * - Le comportement natif de Tab entre cellules est préservé.
 */
import { useCallback, useRef } from "react";

export function useGridNav<T extends HTMLElement = HTMLTableElement>(options?: {
  onAppendRow?: () => void;
}) {
  const ref = useRef<T | null>(null);

  const findCell = useCallback(
    (row: number, col: string): HTMLElement | null => {
      const root = ref.current;
      if (!root) return null;
      return root.querySelector<HTMLElement>(
        `[data-row="${row}"][data-col="${col}"]`,
      );
    },
    [],
  );

  const focusableInRow = useCallback((row: number): HTMLElement[] => {
    const root = ref.current;
    if (!root) return [];
    return Array.from(
      root.querySelectorAll<HTMLElement>(`[data-row="${row}"][data-col]`),
    ).filter((el) => !(el as HTMLInputElement).disabled);
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const rowAttr = target.getAttribute?.("data-row");
      const colAttr = target.getAttribute?.("data-col");
      if (rowAttr == null || colAttr == null) return;
      const row = Number(rowAttr);
      if (!isFinite(row)) return;

      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const nextRow = row + 1;
        const next = findCell(nextRow, colAttr);
        if (next) {
          e.preventDefault();
          next.focus();
          if (next instanceof HTMLInputElement) next.select?.();
        } else if (options?.onAppendRow) {
          e.preventDefault();
          options.onAppendRow();
          requestAnimationFrame(() => {
            const created = findCell(nextRow, colAttr);
            if (created) {
              created.focus();
              if (created instanceof HTMLInputElement) created.select?.();
            }
          });
        }
        return;
      }

      if (e.key === "Tab" && !e.shiftKey && options?.onAppendRow) {
        // Est-ce la dernière cellule éditable de la ligne courante ?
        const inRow = focusableInRow(row);
        const idx = inRow.indexOf(target);
        const isLastCol = idx === inRow.length - 1;
        // Est-ce la dernière ligne ?
        const nextRowExists = focusableInRow(row + 1).length > 0;
        if (isLastCol && !nextRowExists) {
          e.preventDefault();
          options.onAppendRow();
          requestAnimationFrame(() => {
            const firstInNew = focusableInRow(row + 1)[0];
            firstInNew?.focus();
            if (firstInNew instanceof HTMLInputElement) firstInNew.select?.();
          });
        }
      }
    },
    [findCell, focusableInRow, options],
  );

  return { ref, onKeyDown };
}
