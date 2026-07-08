/**
 * Rendu partagé des tableaux d'un référentiel : liste de lignes
 * (clé JSON / valeur JSON) avec troncature et dépliement des valeurs
 * volumineuses. Réutilisable depuis la page de consultation d'un
 * référentiel et l'éditeur d'édition.
 */
import { useMemo } from "react";

export interface ReferentielRowItem {
  cle: unknown;
  valeur: unknown;
}

export function ReferentielRowsTable({
  rows,
  maxRows,
}: {
  rows: ReferentielRowItem[];
  maxRows?: number;
}) {
  const displayed = useMemo(
    () => (maxRows ? rows.slice(0, maxRows) : rows),
    [rows, maxRows],
  );
  const hidden = maxRows ? Math.max(0, rows.length - maxRows) : 0;

  if (rows.length === 0) {
    return (
      <div className="text-sm text-muted-foreground border rounded-md p-4 text-center">
        Aucune ligne.
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <div className="max-h-[600px] overflow-auto">
        <table className="w-full text-xs font-mono">
          <thead className="bg-muted sticky top-0">
            <tr>
              <th className="text-left px-3 py-2 border-b">Clé</th>
              <th className="text-left px-3 py-2 border-b">Valeur</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((row, i) => (
              <tr key={i} className="border-b hover:bg-muted/40">
                <td className="px-3 py-1.5 align-top whitespace-nowrap text-muted-foreground">
                  {JSON.stringify(row.cle)}
                </td>
                <td className="px-3 py-1.5 align-top break-all">
                  <ValeurPreview value={row.valeur} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidden > 0 && (
        <div className="p-3 text-xs text-muted-foreground text-center border-t bg-muted/20">
          {hidden} ligne(s) supplémentaire(s) non affichée(s).
        </div>
      )}
    </div>
  );
}

export function ValeurPreview({ value }: { value: unknown }) {
  const s = JSON.stringify(value);
  if (s.length <= 200) return <span>{s}</span>;
  return (
    <details>
      <summary className="cursor-pointer text-muted-foreground">
        {s.slice(0, 160)}… <span className="text-primary">(déplier)</span>
      </summary>
      <pre className="whitespace-pre-wrap text-xs mt-2">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}
