import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useDossier } from "@/hooks/useDossier";
import { Note, Section } from "@/components/vp/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, Camera, CheckCircle2, Download, Eye, Plus, Printer, Trash2, Upload } from "lucide-react";
import {
  CATEGORIE_LABEL,
  calculerSynthese,
  formatEuros,
  hydraterDossier,
  type Categorie,
  type Provision,
} from "@/lib/calculs";


import { REFERENTIEL } from "@/data/referentiel_evaluation";
import { regimePour } from "@/lib/regimes";
import { RegimeVigilance } from "@/components/vp/RegimeVigilance";
import { toast } from "sonner";
import { createSnapshot, deleteSnapshot, listSnapshots, logDossierAction } from "@/lib/dossiers.functions";



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
  const [exporting, setExporting] = useState(false);

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


  async function exportWord() {
    if (!dossier || !synth) return;
    setExporting(true);
    try {
      const { buildReclamationDocx, downloadDocx, buildFilename, loadLogoAsset } =
        await import("@/lib/export/docxReclamation");
      const logoAsset = (await import("@/assets/logo-vp.png.asset.json")).default;
      let logo: { data: Uint8Array; type: "png" } | null = null;
      try {
        logo = await loadLogoAsset(logoAsset.url);
      } catch {
        logo = null;
      }
      const { document } = buildReclamationDocx({ dossier, synthese: synth, logo });
      await downloadDocx(document, buildFilename(dossier.reference));
      toast.success("Document Word généré");
      logDossierAction({ data: { dossierId: id, action: "export_word" } }).catch(() => {});

    } catch (e) {
      toast.error(`Échec de la génération : ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
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
          <Button size="sm" variant="outline" onClick={exportWord} disabled={exporting}>
            <Download className="w-4 h-4 mr-1" /> {exporting ? "Génération…" : "Exporter en Word"}
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

      <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span>
          Régime&nbsp;: <span className="font-medium text-foreground">{regimePour(dossier.faitGenerateur).libelle}</span>
        </span>
        <a href="#regime-vigilance-synthese" className="text-primary hover:underline">
          Voir les points de vigilance
        </a>
      </div>

      <div id="regime-vigilance-synthese">
        <RegimeVigilance faitGenerateur={dossier.faitGenerateur} />
      </div>

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

      <SnapshotsSection dossierId={id} totalVictimeCourant={synth.totalVictime} />






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


      <div className="mt-6 rounded-md border border-primary/30 bg-primary/5 px-4 py-3 space-y-2">
        <div className="font-display font-semibold text-foreground text-sm">Référentiels retenus</div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>Capitalisation : <span className="text-foreground font-medium">Gazette du Palais 2025</span> (taux 0,5 %), table <span className="text-foreground font-medium">{dossier.tableMortalite}</span>.</span>
          <span>Valeur du point AIPP : <span className="text-foreground font-medium">Référentiel Mornet, édition septembre 2025</span>.</span>
          <span>Fourchettes indicatives : <span className="text-foreground font-medium">Référentiel Mornet, édition septembre 2025</span>.</span>
          <span>Date du chiffrage : <span className="text-foreground font-medium">{new Date().toLocaleDateString("fr-FR")}</span>.</span>
        </div>
      </div>

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

function SnapshotsSection({ dossierId, totalVictimeCourant }: { dossierId: string; totalVictimeCourant: number }) {
  const qc = useQueryClient();
  const list = useServerFn(listSnapshots);
  const create = useServerFn(createSnapshot);
  const del = useServerFn(deleteSnapshot);
  const [open, setOpen] = useState(false);
  const suggestion = `Chiffrage du ${new Date().toLocaleDateString("fr-FR")}`;
  const [nom, setNom] = useState(suggestion);

  const { data: snapshots = [] } = useQuery({
    queryKey: ["snapshots", dossierId],
    queryFn: () => list({ data: { dossierId } }),
  });

  const mCreate = useMutation({
    mutationFn: (n: string) => create({ data: { dossierId, nom: n } }),
    onSuccess: () => {
      toast.success("Chiffrage figé");
      qc.invalidateQueries({ queryKey: ["snapshots", dossierId] });
      setOpen(false);
      setNom(`Chiffrage du ${new Date().toLocaleDateString("fr-FR")}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Chiffrage figé supprimé");
      qc.invalidateQueries({ queryKey: ["snapshots", dossierId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <Section
      title="Chiffrages figés"
      description="Enregistrer un instantané daté du dossier (réclamation, offre adverse, conclusions). Ces chiffrages restent consultables en lecture seule même après modification du dossier."
    >
      <div className="flex justify-between items-center mb-3 print:hidden">
        <div className="text-sm text-muted-foreground">
          Part victime courante : <span className="font-medium tabular-nums text-foreground">{formatEuros(totalVictimeCourant)}</span>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Camera className="w-4 h-4 mr-2" />Figer ce chiffrage</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Figer le chiffrage actuel</DialogTitle>
              <DialogDescription>
                Enregistre l'état complet du dossier et le résultat des calculs. Ce chiffrage ne sera pas modifié lorsque vous continuerez à travailler sur le dossier.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="snapshot-nom">Nom du chiffrage</label>
              <Input
                id="snapshot-nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder={suggestion}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button
                disabled={!nom.trim() || mCreate.isPending}
                onClick={() => mCreate.mutate(nom.trim())}
              >
                {mCreate.isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Part victime</TableHead>
            <TableHead className="w-32 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {snapshots.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                Aucun chiffrage figé pour ce dossier.
              </TableCell>
            </TableRow>
          )}
          {snapshots.map((s) => {
            const synth = s.synthese as unknown as { totalVictime?: number };
            return (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.nom}</TableCell>
                <TableCell>{new Date(s.created_at).toLocaleString("fr-FR")}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {typeof synth.totalVictime === "number" ? formatEuros(synth.totalVictime) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    to="/dossiers/$id/snapshots/$snapshotId"
                    params={{ id: dossierId, snapshotId: s.id }}
                    className="inline-flex items-center gap-1 text-xs rounded-md border border-border px-2.5 py-1 hover:bg-muted/60 mr-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Consulter
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce chiffrage figé ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          « {s.nom} » sera définitivement supprimé. Cette action est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => mDelete.mutate(s.id)}>
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Section>
  );
}
