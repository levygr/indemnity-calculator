import { Info } from "lucide-react";
import { regimePour } from "@/lib/regimes";
import type { FaitGenerateur } from "@/lib/calculs/types";

interface Props {
  faitGenerateur: FaitGenerateur;
  id?: string;
}

export function RegimeVigilance({ faitGenerateur, id }: Props) {
  const regime = regimePour(faitGenerateur);
  return (
    <div
      id={id}
      className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-4"
    >
      <div className="flex items-center gap-2 text-primary font-display font-semibold text-sm">
        <Info className="w-4 h-4" />
        Points de vigilance du régime — {regime.libelle}
      </div>
      {regime.alertes.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary/80">
            Alertes
          </div>
          <ul className="mt-1 list-disc pl-5 space-y-1 text-sm text-foreground/90">
            {regime.alertes.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {regime.pointsDeVigilance.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary/80">
            À vérifier
          </div>
          <ul className="mt-1 list-disc pl-5 space-y-1 text-sm text-foreground/90">
            {regime.pointsDeVigilance.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground italic">
        Aides internes indicatives, à relire et valider par un avocat du cabinet
        avant tout usage.
      </p>
    </div>
  );
}
