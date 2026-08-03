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
    <div id={id} className="mt-4 border-l-2 border-primary/50 pl-4 py-1">
      <div className="flex items-center gap-2 text-[11px] font-display font-semibold uppercase tracking-[0.12em] text-primary">
        <Info className="w-3.5 h-3.5" aria-hidden="true" />
        Points de vigilance — {regime.libelle}
      </div>
      {regime.alertes.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-display font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Alertes
          </div>
          <ul className="mt-1 list-disc pl-5 space-y-1 text-[13px] leading-relaxed text-foreground/90">
            {regime.alertes.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {regime.pointsDeVigilance.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-display font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            À vérifier
          </div>
          <ul className="mt-1 list-disc pl-5 space-y-1 text-[13px] leading-relaxed text-foreground/90">
            {regime.pointsDeVigilance.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground italic">
        Aides internes indicatives, à relire et valider par un avocat du cabinet
        avant tout usage.
      </p>
    </div>
  );
}

