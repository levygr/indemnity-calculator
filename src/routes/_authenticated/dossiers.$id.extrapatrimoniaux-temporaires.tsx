import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useDossier } from "@/hooks/useDossier";
import { Field, Note, Section } from "@/components/vp/Field";
import { Input } from "@/components/ui/input";
import { calculerDFT, formatEuros, detteResponsable } from "@/lib/calculs";
import { FourchetteDegreHint } from "@/components/vp/FourchetteHint";
import { REFERENTIEL } from "@/data/referentiel_evaluation";

export const Route = createFileRoute("/_authenticated/dossiers/$id/extrapatrimoniaux-temporaires")({
  component: ExtraTempPage,
});

function ExtraTempPage() {
  const { id } = Route.useParams();
  const { dossier, update } = useDossier(id);
  if (!dossier) return null;
  return <ExtraTempPageInner dossier={dossier} update={update} />;
}

function ExtraTempPageInner({
  dossier,
  update,
}: {
  dossier: NonNullable<ReturnType<typeof useDossier>["dossier"]>;
  update: ReturnType<typeof useDossier>["update"];
}) {
  const pt = dossier.postesTemp;
  const dft = useMemo(() => calculerDFT(dossier.periodesDFT, pt.dft.tauxJournalier), [dossier.periodesDFT, pt.dft.tauxJournalier]);

  const detteDFT = detteResponsable(dft.montant, dossier.fFaute, dossier.fChance);
  const detteSE = detteResponsable(pt.se.montant, dossier.fFaute, dossier.fChance);
  const dettePET = detteResponsable(pt.pet.montant, dossier.fFaute, dossier.fChance);
  const totalExtra = dft.montant + pt.se.montant + pt.pet.montant;

  function patchPT<K extends "dft" | "se" | "pet">(key: K, patch: Partial<typeof pt[K]>) {
    update({ postesTemp: { ...pt, [key]: { ...pt[key], ...patch } } });
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <div className="text-xs font-display font-semibold text-primary tracking-wide">
          PAGE 3 — PRÉJUDICES EXTRAPATRIMONIAUX TEMPORAIRES
        </div>
        <h1 className="mt-1 text-2xl font-display font-semibold">DFT, SE, PET</h1>
      </header>

      <Section
        title="Déficit fonctionnel temporaire (DFT)"
        description="Le nombre de jours et les taux sont saisis sur la page 1. On applique ici le taux journalier retenu."
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Taux journalier (€/jour à 100 %)" hint={REFERENTIEL.dftIndicatif.note}>
            <Input type="number" min={0} step="0.5" value={pt.dft.tauxJournalier} onChange={(e) => patchPT("dft", { tauxJournalier: Number(e.target.value) || 0 })} />
          </Field>
          <Recap label="Jours totaux" value={String(dft.joursTotaux)} />
          <Recap label="Jours pondérés" value={dft.joursPonderes.toFixed(2)} />
          <Recap label="Montant DFT" value={formatEuros(dft.montant)} accent="primary" />
        </div>
        {dossier.periodesDFT.length === 0 && (
          <div className="mt-4"><Note variant="warning">Aucune période de DFT saisie sur la page 1.</Note></div>
        )}
        <div className="mt-4"><Note>Dette du responsable après fractions : {formatEuros(detteDFT)}.</Note></div>
      </Section>

      <Section
        title="Souffrances endurées (SE)"
        description={`Cotation retenue sur la page 1 : ${dossier.souffrancesEndurees} / 7.`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Montant retenu (€)" hint="Saisir la valorisation, aucune valeur inventée.">
            <Input type="number" min={0} step="100" value={pt.se.montant} onChange={(e) => patchPT("se", { montant: Number(e.target.value) || 0 })} />
          </Field>
          <Recap label="Dette responsable" value={formatEuros(detteSE)} />
        </div>
        <FourchetteDegreHint poste="SE" degre={dossier.souffrancesEndurees} />
      </Section>

      <Section
        title="Préjudice esthétique temporaire (PET)"
        description={`Cotation retenue sur la page 1 : ${dossier.esthetiqueTemp} / 7.`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Montant retenu (€)">
            <Input type="number" min={0} step="100" value={pt.pet.montant} onChange={(e) => patchPT("pet", { montant: Number(e.target.value) || 0 })} />
          </Field>
          <Recap label="Dette responsable" value={formatEuros(dettePET)} />
        </div>
        <FourchetteDegreHint poste="PET" degre={dossier.esthetiqueTemp} />
      </Section>


      <Section title="Total extrapatrimoniaux temporaires">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Recap label="DFT" value={formatEuros(dft.montant)} />
          <Recap label="SE" value={formatEuros(pt.se.montant)} />
          <Recap label="PET" value={formatEuros(pt.pet.montant)} />
          <Recap label="Total" value={formatEuros(totalExtra)} accent="primary" />
        </div>
      </Section>
    </div>
  );
}

function Recap({ label, value, accent }: { label: string; value: string; accent?: "victime" | "tiers" | "primary" }) {
  const cls =
    accent === "victime" ? "text-victime" :
    accent === "tiers" ? "text-tiers" :
    accent === "primary" ? "text-primary" :
    "text-foreground";
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-display">{label}</div>
      <div className={`mt-0.5 font-display font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
