/**
 * Rendu partagé des tableaux d'une synthèse (totaux + lignes par catégorie),
 * utilisé à la fois par la page synthèse vivante et par la consultation
 * d'un chiffrage figé.
 */
import { Section } from "@/components/vp/Field";
import { LiveAnnouncer } from "@/components/vp/LiveAnnouncer";
import {
  Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CATEGORIE_LABEL, formatEuros, type Categorie } from "@/lib/calculs";
import type { Synthese } from "@/lib/calculs/postes/synthese";

const ORDRE: Categorie[] = ["PT", "EPT", "PP", "EPP", "DECES", "SURVIE"];

export function SyntheseTotaux({ synth }: { synth: Synthese }) {
  return (
    <Section title="Totaux généraux">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3" aria-live="polite" aria-atomic="true">
        <Recap label="Montant total des postes" value={formatEuros(synth.totalMontant)} />
        <Recap label="Créance tiers payeurs" value={formatEuros(synth.totalTP)} />
        <Recap label="Dette du responsable" value={formatEuros(synth.totalDette)} />
        <Recap label="Part victime (droit de préférence)" value={formatEuros(synth.totalVictime)} accent="victime" />
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3" aria-live="polite" aria-atomic="true">
        <Recap label="Part revenant aux tiers payeurs" value={formatEuros(synth.totalTPRepartition)} accent="tiers" />
        <Recap label="Solde revenant à la victime" value={formatEuros(synth.soldeVictime)} accent={synth.soldeVictime < 0 ? "tiers" : "victime"} />
      </div>
      <LiveAnnouncer
        message={`Total mis à jour : ${formatEuros(synth.totalMontant)}. Part victime ${formatEuros(synth.totalVictime)}.`}
      />
    </Section>
  );
}

export function SyntheseCategories({ synth }: { synth: Synthese }) {
  return (
    <>
      {ORDRE.map((cat) => {
        const st = synth.sousTotaux.find((x) => x.categorie === cat);
        if (!st || st.montant === 0) return null;
        const lignes = synth.lignes.filter((l) => l.categorie === cat);
        const catLabel = CATEGORIE_LABEL[cat];
        return (
          <Section key={cat} title={catLabel}>
            <Table>
              <TableCaption className="sr-only">Synthèse — {catLabel}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Poste</TableHead>
                  <TableHead scope="col" className="text-right">Montant</TableHead>
                  <TableHead scope="col" className="text-right">TP</TableHead>
                  <TableHead scope="col" className="text-right">Dette</TableHead>
                  <TableHead scope="col" className="text-right">Part victime</TableHead>
                  <TableHead scope="col" className="text-right">Part TP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l) => (
                  <TableRow key={l.code} className={l.montant === 0 ? "opacity-50" : ""}>
                    <TableCell scope="row" asHeader>
                      <span className="text-xs text-muted-foreground mr-2">{l.code}</span>
                      {l.poste}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatEuros(l.montant)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEuros(l.tiersPayeur)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEuros(l.dette)}</TableCell>
                    <TableCell className="text-right tabular-nums text-success">{formatEuros(l.partVictime)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEuros(l.partTP)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold bg-muted/40">
                  <TableCell scope="row" asHeader>Sous-total</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuros(st.montant)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuros(st.tiersPayeur)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuros(st.dette)}</TableCell>
                  <TableCell className="text-right tabular-nums text-success">{formatEuros(st.partVictime)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuros(st.partTP)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Section>
        );
      })}
    </>
  );
}

function Recap({ label, value, accent }: { label: string; value: string; accent?: "victime" | "tiers" }) {
  const color =
    accent === "victime" ? "text-success" : accent === "tiers" ? "text-warning-foreground" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <div className="text-[11px] text-muted-foreground font-display">{label}</div>
      <div className={`mt-0.5 font-display font-semibold text-lg ${color}`}>{value}</div>
    </div>
  );
}
