import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useDossier } from "@/hooks/useDossier";
import { Field, Note, Section } from "@/components/vp/Field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import {
  buildContexte,
  calculerAdaptation,
  calculerATPPerm,
  calculerDSFPonctuelles,
  calculerDSFRecurrentes,
  calculerIP,
  calculerPGPF,
  detteResponsable,
  formatEuros,
  repartition,
  type AdaptationLigne,
  type ATPPermData,
  type DSFPonctuelle,
  type DSFRecurrente,
  type IPData,
  type PGPFData,
  type PostesPermanents,
} from "@/lib/calculs";
import type { Periodicite } from "@/lib/calculs/annualisation";

export const Route = createFileRoute("/_authenticated/dossiers/$id/patrimoniaux-permanents")({
  component: Page,
});

function uid() { return Math.random().toString(36).slice(2, 10); }
function n(v: string) { const x = Number(v); return isFinite(x) ? x : 0; }
function nOrNull(v: string) { if (v === "") return null; const x = Number(v); return isFinite(x) ? x : null; }

function Page() {
  const { id } = Route.useParams();
  const { dossier, update } = useDossier(id);
  if (!dossier) return null;
  return <PageInner dossier={dossier} update={update} />;
}

function PageInner({
  dossier,
  update,
}: {
  dossier: NonNullable<ReturnType<typeof useDossier>["dossier"]>;
  update: ReturnType<typeof useDossier>["update"];
}) {
  const pp = dossier.postesPerm;
  const ctx = useMemo(() => buildContexte(dossier), [dossier]);

  function patch(patchP: Partial<PostesPermanents>) {
    update({ postesPerm: { ...dossier!.postesPerm, ...patchP } });
  }

  const dsfP = useMemo(() => calculerDSFPonctuelles(pp.dsfPonctuelles), [pp.dsfPonctuelles]);
  const dsfR = useMemo(() => calculerDSFRecurrentes(pp.dsfRecurrentes, ctx), [pp.dsfRecurrentes, ctx]);
  const atp = useMemo(() => calculerATPPerm(pp.atpPerm, ctx), [pp.atpPerm, ctx]);
  const pgpf = useMemo(() => calculerPGPF(pp.pgpf, ctx), [pp.pgpf, ctx]);
  const ip = useMemo(() => calculerIP(pp.ip, ctx), [pp.ip, ctx]);
  const log = useMemo(() => calculerAdaptation(pp.logement, ctx), [pp.logement, ctx]);
  const veh = useMemo(() => calculerAdaptation(pp.vehicule, ctx), [pp.vehicule, ctx]);

  const totalDSF = dsfP.totalMontant + dsfR.totalDette;
  const tpDSF = dsfP.totalTP + dsfR.totalTP;
  const detteDSF = detteResponsable(totalDSF, dossier.fFaute, dossier.fChance);
  const repDSF = repartition(totalDSF, tpDSF, detteDSF);

  const detteATP = detteResponsable(atp.capital, dossier.fFaute, dossier.fChance);
  const repATP = repartition(atp.capital, atp.capitalTP, detteATP);
  const dettePGPF = detteResponsable(pgpf.capital, dossier.fFaute, dossier.fChance);
  const repPGPF = repartition(pgpf.capital, pgpf.capitalTP, dettePGPF);
  const detteIP = detteResponsable(ip.total, dossier.fFaute, dossier.fChance);
  const repIP = repartition(ip.total, ip.totalTP, detteIP);
  const detteLog = detteResponsable(log.total, dossier.fFaute, dossier.fChance);
  const repLog = repartition(log.total, log.totalTP, detteLog);
  const detteVeh = detteResponsable(veh.total, dossier.fFaute, dossier.fChance);
  const repVeh = repartition(veh.total, veh.totalTP, detteVeh);

  // ------- helpers d'édition -------
  function addDSFP() {
    patch({ dsfPonctuelles: [...pp.dsfPonctuelles, { id: uid(), libelle: "", montant: 0, tiersPayeur: 0 }] });
  }
  function patchDSFP(idL: string, p: Partial<DSFPonctuelle>) {
    patch({ dsfPonctuelles: pp.dsfPonctuelles.map((l) => l.id === idL ? { ...l, ...p } : l) });
  }
  function delDSFP(idL: string) { patch({ dsfPonctuelles: pp.dsfPonctuelles.filter((l) => l.id !== idL) }); }

  function addDSFR() {
    patch({ dsfRecurrentes: [...pp.dsfRecurrentes, { id: uid(), libelle: "", montant: 0, periodicite: "an", tiersPayeur: 0, capitalisation: "viager", ageFin: null }] });
  }
  function patchDSFR(idL: string, p: Partial<DSFRecurrente>) {
    patch({ dsfRecurrentes: pp.dsfRecurrentes.map((l) => l.id === idL ? { ...l, ...p } : l) });
  }
  function delDSFR(idL: string) { patch({ dsfRecurrentes: pp.dsfRecurrentes.filter((l) => l.id !== idL) }); }

  function patchATPP(p: Partial<ATPPermData>) { patch({ atpPerm: { ...pp.atpPerm, ...p } }); }
  function patchPGPF(p: Partial<PGPFData>) { patch({ pgpf: { ...pp.pgpf, ...p } }); }
  function patchIP(p: Partial<IPData>) { patch({ ip: { ...pp.ip, ...p } }); }

  function addAdapt(key: "logement" | "vehicule") {
    patch({ [key]: [...pp[key], { id: uid(), libelle: "", montant: 0, recurrent: false, periodicite: "an", capitalisation: "viager", ageFin: null, tiersPayeur: 0 }] } as Partial<PostesPermanents>);
  }
  function patchAdapt(key: "logement" | "vehicule", idL: string, p: Partial<AdaptationLigne>) {
    patch({ [key]: pp[key].map((l) => l.id === idL ? { ...l, ...p } : l) } as Partial<PostesPermanents>);
  }
  function delAdapt(key: "logement" | "vehicule", idL: string) {
    patch({ [key]: pp[key].filter((l) => l.id !== idL) } as Partial<PostesPermanents>);
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header>
        <div className="text-xs font-display font-semibold text-primary tracking-wide">
          PAGE 3 — PRÉJUDICES PATRIMONIAUX PERMANENTS
        </div>
        <h1 className="mt-1 text-2xl font-display font-semibold">DSF, ATP perm., PGPF, IP, adaptation logement / véhicule</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Toutes les capitalisations utilisent le barème {dossier.bareme} {dossier.sexe === "F" ? "femmes" : dossier.sexe === "M" ? "hommes" : "indéterminé"} 2025 (taux 0,5 %).
          Âge à la liquidation : {ctx.ageLiquidation ?? "—"}, âge à la consolidation : {ctx.ageConsolidation ?? "—"}.
        </p>
      </header>

      {ctx.ageLiquidation == null && (
        <Note variant="warning">Renseignez la date de naissance et la date de liquidation dans la page « Dossier » pour activer les capitalisations.</Note>
      )}

      {/* -------- DSF ponctuelles -------- */}
      <Section title="Dépenses de santé futures — ponctuelles (DSF)" description="Frais futurs non récurrents (ex. prothèse à remplacer). Non capitalisés, non revalorisés.">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead><TableHead>Montant (€)</TableHead><TableHead>TP (€)</TableHead><TableHead>Reste (€)</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pp.dsfPonctuelles.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucune dépense ponctuelle.</TableCell></TableRow>
              )}
              {pp.dsfPonctuelles.map((l) => {
                const c = dsfP.lignes.find((x) => x.id === l.id);
                return (
                  <TableRow key={l.id} className="vp-row-alt">
                    <TableCell><Input value={l.libelle} onChange={(e) => patchDSFP(l.id, { libelle: e.target.value })} /></TableCell>
                    <TableCell className="w-32"><Input type="number" min={0} step="0.01" value={l.montant} onChange={(e) => patchDSFP(l.id, { montant: n(e.target.value) })} /></TableCell>
                    <TableCell className="w-32"><Input type="number" min={0} step="0.01" value={l.tiersPayeur} onChange={(e) => patchDSFP(l.id, { tiersPayeur: n(e.target.value) })} /></TableCell>
                    <TableCell className="font-medium">{formatEuros(c?.resteACharge ?? 0)}</TableCell>
                    <TableCell><IconDel onClick={() => delDSFP(l.id)} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex justify-between">
          <Button size="sm" variant="outline" onClick={addDSFP}><Plus className="w-4 h-4 mr-2" />Ajouter</Button>
          <TotalPill label="Total DSF ponctuelles (reste)" value={dsfP.totalReste} />
        </div>
      </Section>

      {/* -------- DSF récurrentes -------- */}
      <Section title="Dépenses de santé futures — récurrentes" description="Frais périodiques capitalisés à la date de liquidation. « Viager » = jusqu'à la fin de vie ; « Temporaire » = jusqu'à un âge donné.">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead><TableHead>Montant</TableHead><TableHead>Périodicité</TableHead>
                <TableHead>Capitalisation</TableHead><TableHead>Âge fin</TableHead>
                <TableHead>TP annuel</TableHead><TableHead>PER</TableHead><TableHead>Capital reste</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pp.dsfRecurrentes.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Aucune dépense récurrente.</TableCell></TableRow>
              )}
              {pp.dsfRecurrentes.map((l) => {
                const c = dsfR.lignes.find((x) => x.id === l.id);
                return (
                  <TableRow key={l.id} className="vp-row-alt">
                    <TableCell><Input value={l.libelle} onChange={(e) => patchDSFR(l.id, { libelle: e.target.value })} /></TableCell>
                    <TableCell className="w-24"><Input type="number" min={0} step="0.01" value={l.montant} onChange={(e) => patchDSFR(l.id, { montant: n(e.target.value) })} /></TableCell>
                    <TableCell className="w-28"><PeriodiciteSelect value={l.periodicite} onChange={(v) => patchDSFR(l.id, { periodicite: v })} /></TableCell>
                    <TableCell className="w-32">
                      <Select value={l.capitalisation} onValueChange={(v) => patchDSFR(l.id, { capitalisation: v as "viager" | "temporaire" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viager">Viager</SelectItem>
                          <SelectItem value="temporaire">Temporaire</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="w-24"><Input type="number" min={0} step={1} value={l.ageFin ?? ""} disabled={l.capitalisation === "viager"} onChange={(e) => patchDSFR(l.id, { ageFin: nOrNull(e.target.value) })} /></TableCell>
                    <TableCell className="w-24"><Input type="number" min={0} step="0.01" value={l.tiersPayeur} onChange={(e) => patchDSFR(l.id, { tiersPayeur: n(e.target.value) })} /></TableCell>
                    <TableCell className="text-muted-foreground">{(c?.per ?? 0).toFixed(3)}</TableCell>
                    <TableCell className="font-medium">{formatEuros(c?.capitalReste ?? 0)}</TableCell>
                    <TableCell><IconDel onClick={() => delDSFR(l.id)} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex justify-between">
          <Button size="sm" variant="outline" onClick={addDSFR}><Plus className="w-4 h-4 mr-2" />Ajouter</Button>
          <TotalPill label="Total DSF récurrentes (capital reste)" value={dsfR.totalReste} />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Recap label="Total DSF (poste)" value={formatEuros(totalDSF)} />
          <Recap label="Créance TP" value={formatEuros(tpDSF)} accent="tiers" />
          <Recap label="Part victime" value={formatEuros(repDSF.victime)} accent="victime" />
        </div>
        <EchusInfo echus={{ montant: dsfR.totalEchus.montant, tp: dsfR.totalEchus.tp }} aEchoirLabel="Capital à échoir DSF récurrentes" aEchoir={{ montant: dsfR.totalAEchoir.montant, tp: dsfR.totalAEchoir.tp }} />
      </Section>

      {/* -------- ATP permanente -------- */}
      <Section title="Assistance tierce personne — permanente (ATP perm.)" description="Rente annuelle = taux horaire × h/j × facteur (usuel 412). Capitalisée en viager ou jusqu'à un âge.">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <Field label="Taux horaire (€/h)"><Input type="number" min={0} step="0.01" value={pp.atpPerm.tauxHoraire} onChange={(e) => patchATPP({ tauxHoraire: n(e.target.value) })} /></Field>
          <Field label="Heures / jour"><Input type="number" min={0} step="0.5" value={pp.atpPerm.heuresParJour} onChange={(e) => patchATPP({ heuresParJour: n(e.target.value) })} /></Field>
          <Field label="Facteur jours"><Input type="number" min={0} step={1} value={pp.atpPerm.facteurJours} onChange={(e) => patchATPP({ facteurJours: n(e.target.value) })} /></Field>
          <Field label="Capitalisation">
            <Select value={pp.atpPerm.capitalisation} onValueChange={(v) => patchATPP({ capitalisation: v as "viager" | "temporaire" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="viager">Viager</SelectItem>
                <SelectItem value="temporaire">Temporaire</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Âge fin"><Input type="number" min={0} step={1} value={pp.atpPerm.ageFin ?? ""} disabled={pp.atpPerm.capitalisation === "viager"} onChange={(e) => patchATPP({ ageFin: nOrNull(e.target.value) })} /></Field>
          <Field label="TP annuel (PCH…)"><Input type="number" min={0} step="0.01" value={pp.atpPerm.tiersPayeur} onChange={(e) => patchATPP({ tiersPayeur: n(e.target.value) })} /></Field>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Recap label="Rente annuelle" value={formatEuros(atp.renteAnnuelle)} />
          <Recap label="PER" value={atp.per.toFixed(3)} />
          <Recap label="Capital dette" value={formatEuros(atp.capital)} />
          <Recap label="Part victime" value={formatEuros(repATP.victime)} accent="victime" />
        </div>
        <EchusInfo echus={{ montant: atp.echus.montant, tp: atp.echus.tp }} aEchoirLabel={`Capital à échoir : rente ${formatEuros(atp.aEchoir.renteAnnuelle)} × PER ${atp.aEchoir.per.toFixed(3)}`} aEchoir={{ montant: atp.aEchoir.capital, tp: atp.aEchoir.capitalTP }} />
      </Section>

      {/* -------- PGPF -------- */}
      <Section title="Pertes de gains professionnels futurs (PGPF)" description="Rente annuelle nette × PER. Trois modes : viager, temporaire (âge fin) ou différée (âge de début, ex. reprise différée)."> 
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <Field label="Rente annuelle nette (€)"><Input type="number" min={0} step="0.01" value={pp.pgpf.renteAnnuelle} onChange={(e) => patchPGPF({ renteAnnuelle: n(e.target.value) })} /></Field>
          <Field label="Capitalisation">
            <Select value={pp.pgpf.capitalisation} onValueChange={(v) => patchPGPF({ capitalisation: v as PGPFData["capitalisation"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="viager">Viager</SelectItem>
                <SelectItem value="temporaire">Temporaire</SelectItem>
                <SelectItem value="differee">Différée</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Âge début" hint="Requis si différée"><Input type="number" min={0} step={1} value={pp.pgpf.ageDebut ?? ""} disabled={pp.pgpf.capitalisation !== "differee"} onChange={(e) => patchPGPF({ ageDebut: nOrNull(e.target.value) })} /></Field>
          <Field label="Âge fin" hint="Requis si temporaire"><Input type="number" min={0} step={1} value={pp.pgpf.ageFin ?? ""} disabled={pp.pgpf.capitalisation !== "temporaire"} onChange={(e) => patchPGPF({ ageFin: nOrNull(e.target.value) })} /></Field>
          <Field label="TP annuel (rente TP)"><Input type="number" min={0} step="0.01" value={pp.pgpf.tiersPayeur} onChange={(e) => patchPGPF({ tiersPayeur: n(e.target.value) })} /></Field>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Recap label="PER" value={pgpf.per.toFixed(3)} />
          <Recap label="Capital dette" value={formatEuros(pgpf.capital)} />
          <Recap label="Capital TP" value={formatEuros(pgpf.capitalTP)} accent="tiers" />
          <Recap label="Part victime" value={formatEuros(repPGPF.victime)} accent="victime" />
        </div>
        <EchusInfo echus={{ montant: pgpf.echus.montant, tp: pgpf.echus.tp }} aEchoirLabel={`Capital à échoir : rente ${formatEuros(pgpf.aEchoir.renteAnnuelle)} × PER ${pgpf.aEchoir.per.toFixed(3)}`} aEchoir={{ montant: pgpf.aEchoir.capital, tp: pgpf.aEchoir.capitalTP }} />
      </Section>

      {/* -------- IP -------- */}
      <Section title="Incidence professionnelle (IP)" description="Forfait (dévalorisation, pénibilité) + perte de retraite (rente différée à l'âge d'ouverture des droits).">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Field label="Forfait IP (€)"><Input type="number" min={0} step="0.01" value={pp.ip.forfait} onChange={(e) => patchIP({ forfait: n(e.target.value) })} /></Field>
          <Field label="Perte de retraite — rente annuelle (€)"><Input type="number" min={0} step="0.01" value={pp.ip.perteRetraiteRente} onChange={(e) => patchIP({ perteRetraiteRente: n(e.target.value) })} /></Field>
          <Field label="Âge d'ouverture des droits"><Input type="number" min={0} step={1} value={pp.ip.perteRetraiteAgeDebut ?? ""} onChange={(e) => patchIP({ perteRetraiteAgeDebut: nOrNull(e.target.value) })} /></Field>
          <Field label="TP annuel"><Input type="number" min={0} step="0.01" value={pp.ip.perteRetraiteTP} onChange={(e) => patchIP({ perteRetraiteTP: n(e.target.value) })} /></Field>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Recap label="Retraite — PER" value={ip.retraite.per.toFixed(3)} />
          <Recap label="Retraite — capital dette" value={formatEuros(ip.retraite.capital)} />
          <Recap label="Total IP" value={formatEuros(ip.total)} />
          <Recap label="Part victime" value={formatEuros(repIP.victime)} accent="victime" />
        </div>
      </Section>

      {/* -------- PSU -------- */}
      <Section
        title="Préjudice scolaire, universitaire ou de formation (PSU)"
        description="Forfait indemnisant le retard, le redoublement, la réorientation ou la perte d'années de formation subis en raison du dommage."
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Field label="Montant retenu (€)">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={pp.psu.montant}
              onChange={(e) => patch({ psu: { ...pp.psu, montant: n(e.target.value) } })}
            />
          </Field>
          <div className="md:col-span-3">
            <Field label="Note (redoublement, réorientation, perte d'années…)">
              <Input
                value={pp.psu.note}
                onChange={(e) => patch({ psu: { ...pp.psu, note: e.target.value } })}
                placeholder="Ex. redoublement de terminale, réorientation professionnelle imposée…"
              />
            </Field>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Recap label="Montant PSU" value={formatEuros(Math.max(0, pp.psu.montant || 0))} />
          <Recap
            label="Dette responsable"
            value={formatEuros(detteResponsable(Math.max(0, pp.psu.montant || 0), dossier.fFaute, dossier.fChance))}
          />
          <Recap
            label="Part victime"
            value={formatEuros(
              repartition(
                Math.max(0, pp.psu.montant || 0),
                0,
                detteResponsable(Math.max(0, pp.psu.montant || 0), dossier.fFaute, dossier.fChance),
              ).victime,
            )}
            accent="victime"
          />
        </div>
      </Section>

      {/* -------- Logement -------- */}
      <AdaptationSection
        title="Frais de logement adapté"
        description="Travaux ponctuels ou frais récurrents (surloyer, entretien). Capitalisation viagère ou temporaire pour le récurrent."
        rows={pp.logement} calc={log.lignes} totalReste={log.totalReste} repVictime={repLog.victime}
        echus={{ montant: log.totalEchus.montant, tp: log.totalEchus.tp }}
        aEchoir={{ montant: log.totalAEchoir.montant, tp: log.totalAEchoir.tp }}
        onAdd={() => addAdapt("logement")} onPatch={(id, p) => patchAdapt("logement", id, p)} onDel={(id) => delAdapt("logement", id)}
      />

      {/* -------- Véhicule -------- */}
      <AdaptationSection
        title="Frais de véhicule adapté"
        description="Aménagement, surcoût d'achat, entretien. Même règles de capitalisation que le logement."
        rows={pp.vehicule} calc={veh.lignes} totalReste={veh.totalReste} repVictime={repVeh.victime}
        echus={{ montant: veh.totalEchus.montant, tp: veh.totalEchus.tp }}
        aEchoir={{ montant: veh.totalAEchoir.montant, tp: veh.totalAEchoir.tp }}
        onAdd={() => addAdapt("vehicule")} onPatch={(id, p) => patchAdapt("vehicule", id, p)} onDel={(id) => delAdapt("vehicule", id)}
      />
    </div>
  );
}

function AdaptationSection({
  title, description, rows, calc, totalReste, repVictime, onAdd, onPatch, onDel,
}: {
  title: string; description: string;
  rows: AdaptationLigne[];
  calc: Array<{ id: string; per: number; reste: number }>;
  totalReste: number; repVictime: number;
  onAdd: () => void;
  onPatch: (id: string, p: Partial<AdaptationLigne>) => void;
  onDel: (id: string) => void;
}) {
  return (
    <Section title={title} description={description}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead><TableHead>Montant</TableHead><TableHead>Récurrent</TableHead>
              <TableHead>Périod.</TableHead><TableHead>Capitalisation</TableHead><TableHead>Âge fin</TableHead>
              <TableHead>TP</TableHead><TableHead>PER</TableHead><TableHead>Capital reste</TableHead><TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Aucune ligne.</TableCell></TableRow>
            )}
            {rows.map((l) => {
              const c = calc.find((x) => x.id === l.id);
              return (
                <TableRow key={l.id} className="vp-row-alt">
                  <TableCell><Input value={l.libelle} onChange={(e) => onPatch(l.id, { libelle: e.target.value })} /></TableCell>
                  <TableCell className="w-24"><Input type="number" min={0} step="0.01" value={l.montant} onChange={(e) => onPatch(l.id, { montant: n(e.target.value) })} /></TableCell>
                  <TableCell className="w-24">
                    <Select value={l.recurrent ? "oui" : "non"} onValueChange={(v) => onPatch(l.id, { recurrent: v === "oui" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="non">Non</SelectItem><SelectItem value="oui">Oui</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="w-24"><PeriodiciteSelect value={l.periodicite} onChange={(v) => onPatch(l.id, { periodicite: v })} /></TableCell>
                  <TableCell className="w-32">
                    <Select value={l.capitalisation} onValueChange={(v) => onPatch(l.id, { capitalisation: v as "viager" | "temporaire" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viager">Viager</SelectItem>
                        <SelectItem value="temporaire">Temporaire</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="w-20"><Input type="number" min={0} step={1} value={l.ageFin ?? ""} disabled={!l.recurrent || l.capitalisation === "viager"} onChange={(e) => onPatch(l.id, { ageFin: nOrNull(e.target.value) })} /></TableCell>
                  <TableCell className="w-24"><Input type="number" min={0} step="0.01" value={l.tiersPayeur} onChange={(e) => onPatch(l.id, { tiersPayeur: n(e.target.value) })} /></TableCell>
                  <TableCell className="text-muted-foreground">{(c?.per ?? 0).toFixed(3)}</TableCell>
                  <TableCell className="font-medium">{formatEuros(c?.reste ?? 0)}</TableCell>
                  <TableCell><IconDel onClick={() => onDel(l.id)} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="mt-3 flex justify-between">
        <Button size="sm" variant="outline" onClick={onAdd}><Plus className="w-4 h-4 mr-2" />Ajouter</Button>
        <TotalPill label="Total (capital reste)" value={totalReste} />
      </div>
      <div className="mt-3">
        <Note>Part victime après répartition et coefficients : <strong>{formatEuros(repVictime)}</strong></Note>
      </div>
    </Section>
  );
}

function PeriodiciteSelect({ value, onChange }: { value: Periodicite; onChange: (v: Periodicite) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Periodicite)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="jour">Jour</SelectItem>
        <SelectItem value="semaine">Semaine</SelectItem>
        <SelectItem value="mois">Mois</SelectItem>
        <SelectItem value="an">An</SelectItem>
      </SelectContent>
    </Select>
  );
}

function IconDel({ onClick }: { onClick: () => void }) {
  return (
    <Button size="icon" variant="ghost" onClick={onClick} className="h-8 w-8 text-muted-foreground hover:text-destructive">
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}

function TotalPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-sm font-display">
      <span className="text-muted-foreground mr-2">{label}</span>
      <span className="font-semibold text-primary">{formatEuros(value)}</span>
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
