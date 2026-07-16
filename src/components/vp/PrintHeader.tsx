/**
 * En-tête visible uniquement à l'impression : référence du dossier,
 * type de document et date d'édition. Masqué à l'écran.
 */
export function PrintHeader({
  reference,
  document,
}: {
  reference: string;
  document: string;
}) {
  const date = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return (
    <header className="print-header hidden print:block mb-4 pb-2 border-b border-black">
      <div className="text-[10px] uppercase tracking-widest">
        Cabinet Victimes &amp; Préjudices
      </div>
      <div className="flex items-baseline justify-between mt-1 gap-4">
        <div>
          <div className="text-xs">Dossier</div>
          <div className="text-base font-semibold">{reference || "—"}</div>
        </div>
        <div className="text-right">
          <div className="text-xs">Document</div>
          <div className="text-base font-semibold">{document}</div>
        </div>
        <div className="text-right">
          <div className="text-xs">Édité le</div>
          <div className="text-base font-semibold">{date}</div>
        </div>
      </div>
    </header>
  );
}
