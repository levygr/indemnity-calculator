import {
  REFERENTIEL,
  fourchettePourDegre,
  fourchetteAffection,
} from "@/data/referentiel_evaluation";
import { formatEuros } from "@/lib/calculs";

const BASE = `référentiel Mornet, éd. ${REFERENTIEL.edition}`;

function formatBornes(min: number | null, max: number | null): string {
  if (min == null && max != null) return `jusqu'à ${formatEuros(max)}`;
  if (min != null && max == null) return `${formatEuros(min)} et plus`;
  if (min != null && max != null) return `${formatEuros(min)} à ${formatEuros(max)}`;
  return "non publiée";
}

export function FourchetteDegreHint({
  poste,
  degre,
}: {
  poste: "SE" | "PET" | "PEP";
  degre: number;
}) {
  if (poste === "PET") {
    return (
      <p className="mt-1 text-[11px] text-muted-foreground italic">
        Le référentiel Mornet ne publie pas de grille pour ce poste : appréciation
        in concreto (photos, durée, exposition au regard des tiers).
      </p>
    );
  }
  if (!(degre > 0)) return null;
  const f = fourchettePourDegre(poste, degre);
  if (!f) return null;
  const bornes = formatBornes(f.min, f.max);
  const approx = f.approximation
    ? ` (encadrement des degrés ${Math.floor(degre)} et ${Math.ceil(Math.min(degre, 8))})`
    : "";
  return (
    <p className="mt-1 text-[11px] text-muted-foreground">
      Fourchette indicative ({BASE}) : {bornes}
      {approx}
    </p>
  );
}

export function FourchetteAffectionHint({ code }: { code: string }) {
  if (!code) return null;
  const f = fourchetteAffection(code);
  if (!f) return null;
  const bornes = formatBornes(f.min, f.max);
  return (
    <span className="block text-[11px] text-muted-foreground">
      Fourchette ({BASE}) : {bornes}
      {f.note ? <span className="block italic mt-0.5">{f.note}</span> : null}
    </span>
  );
}
