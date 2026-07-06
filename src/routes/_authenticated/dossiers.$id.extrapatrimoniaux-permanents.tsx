import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useDossier } from "@/hooks/useDossier";
import { Field, Note, Section } from "@/components/vp/Field";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  buildContexte,
  calculerDFP,
  detteResponsable,
  formatEuros,
  repartition,
  type DFPData,
  type ForfaitPoste,
  type PostesPermanents,
} from "@/lib/calculs";

export const Route = createFileRoute("/_authenticated/dossiers/$id/extrapatrimoniaux-permanents")({
  component: Page,
});

function n(v: string) { const x = Number(v); return isFinite(x) ? x : 0; }
function nOrNull(v: string) { if (v === "") return null; const x = Number(v); return isFinite(x) ? x : null; }

const FORFAIT_KEYS = ["agrement", "sexuel", "esthetiquePerm", "etablissement", "pathologiesEvo"] as const;
type ForfaitKey = (typeof FORFAIT_KEYS)[number];

const FORFAIT_LABELS: Record<ForfaitKey, { title: string; description: string; cotationLabel?: string }> = {
  agrement: { title: "Préjudice d'agrément (PA)", description: "Impossibilité de pratiquer une activité spécifique de loisirs.", cotationLabel: "Cotation indicative (0-7)" },
  sexuel: { title: "Préjudice sexuel (PSex)", description: "Atteinte à la fonction, à l'acte ou à la fertilité." },
  esthetiquePerm: { title: "Préjudice esthétique permanent (PEP)", description: "Cotation 0 à 7 sur la charte V&P.", cotationLabel: "Cotation (0-7)" },
  etablissement: { title: "Préjudice d'établissement (PE)", description: "Perte de chance d'organiser une vie familiale normale." },
  pathologiesEvo: { title: "Pathologies évolutives / anxiété", description: "Préjudice lié à une pathologie évolutive ou à l'angoisse d'une aggravation." },
};

function Page() {
  const { id } = Route.useParams();
  const { dossier, update } = useDossier(id);
  if (!dossier) return null;

  const pp = dossier.postesPerm;
  const ctx = useMemo(() => buildContexte(dossier), [dossier]);
  const dfp = useMemo(() => calculerDFP(pp.dfp, ctx), [pp.dfp, ctx]);

  function patch(p: Partial<PostesPermanents>) {
    update({ postesPerm: { ...dossier!.postesPerm, ...p } });
  }
  function patchDFP(p: Partial<DFPData>) { patch({ dfp: { ...pp.dfp, ...p } }); }
  function patchForfait(k: ForfaitKey, p: Partial<ForfaitPoste>) {
    patch({ [k]: { ...pp[k], ...p } } as Partial<PostesPermanents>);
  }

  const detteDFP = detteResponsable(dfp.montant, dossier.fFaute, dossier.fChance);
  const repDFP = repartition(dfp.montant, 0, detteDFP);

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <div className="text-xs font-display font-semibold text-primary tracking-wide">
          PAGE 4 — PRÉJUDICES EXTRAPATRIMONIAUX PERMANENTS
        </div>
        <h1 className="mt-1 text-2xl font-display font-semibold">DFP, agrément, PSex, PEP, établissement, pathologies évolutives</h1>
      </header>

      {/* -------- DFP -------- */}
      <Section title="Déficit fonctionnel permanent (DFP)" description="Deux méthodes : valeur du point d'AIPP (barème Intercours) ou montant capitalisé au jour d'espérance de vie.">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Field label="Méthode">
            <Select value={pp.dfp.methode} onValueChange={(v) => patchDFP({ methode: v as DFPData["methode"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="point">Valeur du point (barème)</SelectItem>
                <SelectItem value="capitalise">Montant capitalisé (saisi)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {pp.dfp.methode === "point" ? (
            <>
              <Field label="Taux AIPP (%)" hint="Défini page Dossier">
                <Input type="number" value={dossier.tauxAIPP} readOnly className="bg-muted/40" />
              </Field>
              <Field label="Valeur du point personnalisée (€)" hint="Laisser vide pour utiliser le barème Intercours">
                <Input type="number" min={0} step="0.01" value={pp.dfp.valeurPointCustom ?? ""} onChange={(e) => patchDFP({ valeurPointCustom: nOrNull(e.target.value) })} />
              </Field>
              <Field label="Valeur du point retenue">
                <Input value={formatEuros(dfp.valeurPoint)} readOnly className="bg-muted/40" />
              </Field>
            </>
          ) : (
            <Field label="Montant capitalisé (€)">
              <Input type="number" min={0} step="0.01" value={pp.dfp.montantCapitalise} onChange={(e) => patchDFP({ montantCapitalise: n(e.target.value) })} />
            </Field>
          )}
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Recap label="Montant DFP" value={formatEuros(dfp.montant)} />
          <Recap label="Dette responsable (après coefficients)" value={formatEuros(detteDFP)} />
          <Recap label="Part victime" value={formatEuros(repDFP.victime)} accent="victime" />
        </div>
        {ctx.tauxAIPP <= 0 && pp.dfp.methode === "point" && (
          <div className="mt-3"><Note variant="warning">Renseignez un taux d'AIPP sur la page Dossier pour calculer la valeur du point.</Note></div>
        )}
      </Section>

      {/* -------- Forfaits -------- */}
      {FORFAIT_KEYS.map((k) => {
        const { title, description, cotationLabel } = FORFAIT_LABELS[k];
        const f = pp[k];
        const dette = detteResponsable(f.montant, dossier.fFaute, dossier.fChance);
        const rep = repartition(f.montant, 0, dette);
        return (
          <Section key={k} title={title} description={description}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Field label={cotationLabel ?? "Cotation (indicative)"}>
                <Input type="number" min={0} max={7} step="0.5" value={f.cotation} onChange={(e) => patchForfait(k, { cotation: n(e.target.value) })} />
              </Field>
              <Field label="Montant retenu (€)">
                <Input type="number" min={0} step="0.01" value={f.montant} onChange={(e) => patchForfait(k, { montant: n(e.target.value) })} />
              </Field>
              <Recap label="Dette responsable" value={formatEuros(dette)} />
              <Recap label="Part victime" value={formatEuros(rep.victime)} accent="victime" />
            </div>
          </Section>
        );
      })}
    </div>
  );
}

function Recap({ label, value, accent }: { label: string; value: string; accent?: "victime" | "tiers" }) {
  const color = accent === "victime" ? "text-success" : accent === "tiers" ? "text-warning-foreground" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <div className="text-[11px] text-muted-foreground font-display">{label}</div>
      <div className={`mt-0.5 font-display font-semibold ${color}`}>{value}</div>
    </div>
  );
}
