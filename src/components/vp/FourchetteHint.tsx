import { REFERENTIEL, fourchetteDegre, fourchetteAffection } from "@/data/referentiel_evaluation";
import { formatEuros } from "@/lib/calculs";

function baseText(): string | null {
  if (!REFERENTIEL.edition) return null;
  return `${REFERENTIEL.nom}, éd. ${REFERENTIEL.edition}`;
}

export function FourchetteDegreHint({ poste, degre }: { poste: "SE" | "PET" | "PEP"; degre: number }) {
  const base = baseText();
  if (!base) {
    return (
      <p className="mt-1 text-[11px] text-muted-foreground italic">
        Fourchette indicative non renseignée (compléter src/data/referentiel_evaluation.ts).
      </p>
    );
  }
  const f = fourchetteDegre(poste, degre);
  if (!f) {
    return (
      <p className="mt-1 text-[11px] text-muted-foreground italic">
        Fourchette indicative non renseignée (compléter src/data/referentiel_evaluation.ts).
      </p>
    );
  }
  return (
    <p className="mt-1 text-[11px] text-muted-foreground">
      Fourchette indicative ({base}) : {formatEuros(f.min ?? 0)} – {formatEuros(f.max ?? 0)}
    </p>
  );
}

export function FourchetteAffectionHint({ lien }: { lien: string }) {
  const base = baseText();
  if (!base) {
    return (
      <span className="text-[11px] text-muted-foreground italic">
        Fourchette indicative non renseignée
      </span>
    );
  }
  const f = fourchetteAffection(lien);
  if (!f) {
    return (
      <span className="text-[11px] text-muted-foreground italic">
        Fourchette indicative non renseignée
      </span>
    );
  }
  return (
    <span className="text-[11px] text-muted-foreground">
      Fourchette ({base}) : {formatEuros(f.min ?? 0)} – {formatEuros(f.max ?? 0)}
    </span>
  );
}
