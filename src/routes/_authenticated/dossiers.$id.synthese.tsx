import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef } from "react";
import { useDossier } from "@/hooks/useDossier";
import { Note, Section } from "@/components/vp/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Plus, Printer, Trash2, Upload } from "lucide-react";
import {
  CATEGORIE_LABEL,
  calculerSynthese,
  formatEuros,
  anneesRevolues,
  hydraterDossier,
  type Categorie,
  type Provision,
} from "@/lib/calculs";
import { themiaLink } from "@/lib/themia";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/dossiers/$id/synthese")({
  component: Page,
});

const ORDRE: Categorie[] = ["PT", "EPT", "PP", "EPP", "DECES", "SURVIE"];

function uid() { return Math.random().toString(36).slice(2, 10); }
function num(v: string) { const x = Number(v); return isFinite(x) ? x : 0; }

function Page() {
  const { id } = Route.useParams();
  const { dossier, update } = useDossier(id);
  const fileRef = useRef<HTMLInputElement>(null);

  const synth = useMemo(() => (dossier ? calculerSynthese(dossier) : null), [dossier]);
  if (!dossier || !synth) return null;

  function exportJSON() {
    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dossier-${(dossier!.reference || id).replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        // Hydratation profonde : conserve toutes les valeurs par défaut manquantes
        const merged = hydraterDossier(parsed);
        update(() => merged);
        toast.success("Dossier importé");
      } catch {
        toast.error("Fichier invalide");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-start justify-between gap-4 print:block">
        <div>
          <div className="text-xs font-display font-semibold text-primary tracking-wide">
            PAGE 8 — SYNTHÈSE
          </div>
          <h1 className="mt-1 text-2xl font-display font-semibold">
            Récapitulatif chiffré du dossier {dossier.reference}
          </h1>
        </div>
        <div className="flex gap-2 print:hidden">
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImport} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> Importer JSON
          </Button>
          <Button size="sm" variant="outline" onClick={exportJSON}>
            <Download className="w-4 h-4 mr-1" /> Exporter JSON
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Imprimer / PDF
          </Button>
        </div>
      </header>

      {synth.avertissements.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive font-display font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            Contrôles de cohérence ({synth.avertissements.length})
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {synth.avertissements.map((a, i) => (
              <li key={i} className="text-destructive/90">
                <span className="font-semibold">{a.poste} :</span> {a.message}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-md border border-success/40 bg-success/10 p-3 flex items-center gap-2 text-success text-sm font-display">
          <CheckCircle2 className="w-4 h-4" />
          Aucune incohérence détectée
        </div>
      )}

      <Section title="Totaux généraux">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Recap label="Montant total des postes" value={formatEuros(synth.totalMontant)} />
          <Recap label="Créance tiers payeurs" value={formatEuros(synth.totalTP)} />
          <Recap label="Dette du responsable" value={formatEuros(synth.totalDette)} />
          <Recap label="Part victime (droit de préférence)" value={formatEuros(synth.totalVictime)} accent="victime" />
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Recap label="Part revenant aux tiers payeurs" value={formatEuros(synth.totalTPRepartition)} accent="tiers" />
          <Recap label="Coefficient global appliqué" value={`${(dossier.fFaute * dossier.fChance * 100).toFixed(1)} %`} />
        </div>
        {dossier.fFaute * dossier.fChance < 1 && (
          <div className="mt-3">
            <Note>Fractions de réduction appliquées : faute {(dossier.fFaute * 100).toFixed(0)} % × perte de chance {(dossier.fChance * 100).toFixed(0)} %.</Note>
          </div>
        )}
        <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Part victime (droit de préférence)</span>
            <span className="tabular-nums font-medium">{formatEuros(synth.totalVictime)}</span>
          </div>
          <div className="flex justify-between text-sm text-destructive">
            <span>Provisions versées</span>
            <span className="tabular-nums">− {formatEuros(synth.totalProvisions)}</span>
          </div>
          <div className="flex justify-between items-baseline pt-2 border-t border-primary/20">
            <span className="font-display font-semibold">Solde revenant à la victime</span>
            <span className={`tabular-nums font-display font-semibold text-lg ${synth.soldeVictime < 0 ? "text-destructive" : "text-success"}`}>
              {formatEuros(synth.soldeVictime)}
            </span>
          </div>
        </div>
      </Section>

      <ProvisionsSection
        provisions={dossier.provisions}
        onChange={(list) => update({ provisions: list })}
        total={synth.totalProvisions}
      />

      <Section title="Recherche de décisions comparables" description="Ouvre Themia dans un onglet séparé avec des critères pré-remplis (âge ± 5 ans, AIPP ± 5 points).">
        <div className="flex flex-wrap gap-2 print:hidden">
          {(["DFP", "PGPF", "ATP-P", "PA", "PSex"] as const).map((code) => {
            const ageLiq = anneesRevolues(dossier.dateNaissance, dossier.dateLiquidation);
            const url = themiaLink(code, {
              faitGenerateur: dossier.faitGenerateur,
              age: ageLiq,
              tauxAIPP: dossier.tauxAIPP,
            });
            return (
              <a key={code} href={url} target="_blank" rel="noreferrer noopener"
                 className="inline-flex items-center gap-1.5 text-xs rounded-md border border-border px-3 py-1.5 hover:bg-muted/60">
                {code} <ExternalLink className="w-3 h-3" />
              </a>
            );
          })}
        </div>
      </Section>


      {ORDRE.map((cat) => {
        const st = synth.sousTotaux.find((x) => x.categorie === cat)!;
        const lignes = synth.lignes.filter((l) => l.categorie === cat);
        if (st.montant === 0) return null;
        return (
          <Section key={cat} title={CATEGORIE_LABEL[cat]}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Poste</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">TP</TableHead>
                  <TableHead className="text-right">Dette</TableHead>
                  <TableHead className="text-right">Part victime</TableHead>
                  <TableHead className="text-right">Part TP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l) => (
                  <TableRow key={l.code} className={l.montant === 0 ? "opacity-50" : ""}>
                    <TableCell>
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
                  <TableCell>Sous-total</TableCell>
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

      {synth.recoursTP.parOrganisme.length > 0 && (
        <Section title="Recours des tiers payeurs" description="Ventilation des créances par organisme et par poste. Les créances ventilées ne remplacent pas les champs TP des postes : elles servent de contrôle et alimenteront l'export.">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisme</TableHead>
                  <TableHead>Poste</TableHead>
                  <TableHead className="text-right">Échu</TableHead>
                  <TableHead className="text-right">À échoir</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {synth.recoursTP.parOrganisme.map((o) => {
                  const codes = Object.keys(o.parPoste);
                  return (
                    <>
                      {codes.length === 0 ? (
                        <TableRow key={o.organisme.id} className="opacity-60">
                          <TableCell>{o.organisme.nom || "(sans nom)"}</TableCell>
                          <TableCell colSpan={4} className="text-muted-foreground">Aucune créance ventilée</TableCell>
                        </TableRow>
                      ) : codes.map((code, i) => {
                        const cell = o.parPoste[code];
                        return (
                          <TableRow key={o.organisme.id + code}>
                            {i === 0 ? (
                              <TableCell rowSpan={codes.length + 1} className="align-top font-medium">
                                {o.organisme.nom || "(sans nom)"}
                              </TableCell>
                            ) : null}
                            <TableCell>{code}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEuros(cell.echu)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEuros(cell.aEchoir)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatEuros(cell.total)}</TableCell>
                          </TableRow>
                        );
                      })}
                      {codes.length > 0 && (
                        <TableRow key={o.organisme.id + "-tot"} className="bg-muted/40 font-semibold">
                          <TableCell>Sous-total</TableCell>
                          <TableCell className="text-right tabular-nums">{formatEuros(o.totaux.echu)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatEuros(o.totaux.aEchoir)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatEuros(o.totaux.total)}</TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
                <TableRow className="font-semibold border-t-2">
                  <TableCell colSpan={2}>Total général</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuros(synth.recoursTP.totalGeneral.echu)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuros(synth.recoursTP.totalGeneral.aEchoir)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatEuros(synth.recoursTP.totalGeneral.total)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Section>
      )}


      <div className="text-xs text-muted-foreground text-center pt-4 print:pt-8">
        Cabinet Victimes &amp; Préjudices — Grenoble &amp; Annecy — victimesetprejudices.fr
      </div>
    </div>
  );
}

function Recap({ label, value, accent }: { label: string; value: string; accent?: "victime" | "tiers" }) {
  const color = accent === "victime" ? "text-success" : accent === "tiers" ? "text-warning-foreground" : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <div className="text-[11px] text-muted-foreground font-display">{label}</div>
      <div className={`mt-0.5 font-display font-semibold text-lg ${color}`}>{value}</div>
    </div>
  );
}

function ProvisionsSection({ provisions, onChange, total }: {
  provisions: Provision[];
  onChange: (list: Provision[]) => void;
  total: number;
}) {
  function add() {
    onChange([...provisions, { id: uid(), date: null, montant: 0, debiteur: "" }]);
  }
  function patch(id: string, p: Partial<Provision>) {
    onChange(provisions.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  function del(id: string) { onChange(provisions.filter((x) => x.id !== id)); }
  return (
    <Section title="Provisions versées" description="Provisions et indemnités provisionnelles déjà versées à la victime. Elles s'imputent sur la part revenant à la victime pour déterminer le solde final.">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Date</TableHead>
              <TableHead>Débiteur</TableHead>
              <TableHead className="w-40 text-right">Montant (€)</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {provisions.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Aucune provision.</TableCell></TableRow>
            )}
            {provisions.map((p) => (
              <TableRow key={p.id} className="vp-row-alt">
                <TableCell><Input type="date" value={p.date ?? ""} onChange={(e) => patch(p.id, { date: e.target.value || null })} /></TableCell>
                <TableCell><Input value={p.debiteur} placeholder="Assureur, FGAO…" onChange={(e) => patch(p.id, { debiteur: e.target.value })} /></TableCell>
                <TableCell><Input type="number" min={0} step="0.01" className="text-right" value={p.montant} onChange={(e) => patch(p.id, { montant: num(e.target.value) })} /></TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => del(p.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex justify-between items-center">
        <Button size="sm" variant="outline" onClick={add}><Plus className="w-4 h-4 mr-2" />Ajouter une provision</Button>
        <div className="text-sm font-display">
          <span className="text-muted-foreground mr-2">Total provisions</span>
          <span className="font-semibold text-primary">{formatEuros(total)}</span>
        </div>
      </div>
    </Section>
  );
}
