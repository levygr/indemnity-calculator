import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useDossier } from "@/hooks/useDossier";
import { Field, Note, Section } from "@/components/vp/Field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import type {
  ATPTempPeriode,
  DSAPonctuelle,
  DSARecurrente,
  FraisDiversVictime,
  PGPAData,
  PGPAMethode,
  PGPAPeriode,
  PostesTemporaires,
} from "@/lib/calculs/types";
import {
  calculerATPTemp,
  calculerDSAPonctuelles,
  calculerDSARecurrentes,
  calculerFraisDiversVictime,
  calculerPGPA,
  detteResponsable,
  formatEuros,
  repartition,
} from "@/lib/calculs";
import type { ModeRevalo, IndiceActualisation } from "@/lib/calculs/revalorisation";
import type { Periodicite } from "@/lib/calculs/annualisation";

export const Route = createFileRoute("/_authenticated/dossiers/$id/patrimoniaux-temporaires")({
  component: PatrimoniauxTempPage,
});

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function PatrimoniauxTempPage() {
  const { id } = Route.useParams();
  const { dossier, update } = useDossier(id);
  if (!dossier) return null;
  return <PatrimoniauxTempPageInner dossier={dossier} update={update} />;
}

function PatrimoniauxTempPageInner({
  dossier,
  update,
}: {
  dossier: NonNullable<ReturnType<typeof useDossier>["dossier"]>;
  update: ReturnType<typeof useDossier>["update"];
}) {
  const pt = dossier.postesTemp;

  function patchPT(patch: Partial<PostesTemporaires>) {
    update({ postesTemp: { ...dossier!.postesTemp, ...patch } });
  }

  const dsaPCalc = useMemo(
    () => calculerDSAPonctuelles(pt.dsaPonctuelles, dossier.dateLiquidation),
    [pt.dsaPonctuelles, dossier.dateLiquidation],
  );
  const dsaRCalc = useMemo(
    () => calculerDSARecurrentes(pt.dsaRecurrentes, dossier.dateLiquidation),
    [pt.dsaRecurrentes, dossier.dateLiquidation],
  );
  const atpCalc = useMemo(() => calculerATPTemp(pt.atpTemp), [pt.atpTemp]);
  const pgpaCalc = useMemo(() => calculerPGPA(pt.pgpa, dossier.dateLiquidation), [pt.pgpa, dossier.dateLiquidation]);
  const fdCalc = useMemo(
    () => calculerFraisDiversVictime(pt.fraisDivers, dossier.dateLiquidation),
    [pt.fraisDivers, dossier.dateLiquidation],
  );

  const detteFD = detteResponsable(fdCalc.totalDepenseRevalorisee, dossier.fFaute, dossier.fChance);
  const fdRep = repartition(fdCalc.totalDepenseRevalorisee, fdCalc.totalTpRevalorise, detteFD);

  const totalDSAmontant = dsaPCalc.totalDepenseRevalorisee + dsaRCalc.totalDepenseRevalorisee;
  const totalDSAtp = dsaPCalc.totalTpRevalorise + dsaRCalc.totalTpRevalorise;

  const detteDSA = detteResponsable(totalDSAmontant, dossier.fFaute, dossier.fChance);
  const dsaRep = repartition(totalDSAmontant, totalDSAtp, detteDSA);
  const detteATP = detteResponsable(atpCalc.total, dossier.fFaute, dossier.fChance);
  const dettePGPA = detteResponsable(pgpaCalc.perte, dossier.fFaute, dossier.fChance);
  const pgpaRep = repartition(pgpaCalc.perte, pgpaCalc.tiersPayeur, dettePGPA);

  // --- DSA helpers -------------------------------------------------------
  function addDSAP() {
    patchPT({
      dsaPonctuelles: [
        ...pt.dsaPonctuelles,
        { id: uid(), date: null, libelle: "", depense: 0, tiersPayeur: 0, modeRevalo: "annuel" },
      ],
    });
  }
  function patchDSAP(idL: string, patch: Partial<DSAPonctuelle>) {
    patchPT({
      dsaPonctuelles: pt.dsaPonctuelles.map((l) => (l.id === idL ? { ...l, ...patch } : l)),
    });
  }
  function delDSAP(idL: string) {
    patchPT({ dsaPonctuelles: pt.dsaPonctuelles.filter((l) => l.id !== idL) });
  }
  function addDSAR() {
    patchPT({
      dsaRecurrentes: [
        ...pt.dsaRecurrentes,
        { id: uid(), debut: null, fin: null, libelle: "", montant: 0, periodicite: "mois", tiersPayeur: 0, modeRevalo: "annuel" },
      ],
    });
  }
  function patchDSAR(idL: string, patch: Partial<DSARecurrente>) {
    patchPT({
      dsaRecurrentes: pt.dsaRecurrentes.map((l) => (l.id === idL ? { ...l, ...patch } : l)),
    });
  }
  function delDSAR(idL: string) {
    patchPT({ dsaRecurrentes: pt.dsaRecurrentes.filter((l) => l.id !== idL) });

  // --- Frais divers helpers ----------------------------------------------
  function addFD() {
    patchPT({
      fraisDivers: [
        ...pt.fraisDivers,
        { id: uid(), date: null, libelle: "", montant: 0, tiersPayeur: 0, modeRevalo: "annuel" },
      ],
    });
  }
  function patchFD(idL: string, patch: Partial<FraisDiversVictime>) {
    patchPT({
      fraisDivers: pt.fraisDivers.map((l) => (l.id === idL ? { ...l, ...patch } : l)),
    });
  }
  function delFD(idL: string) {
    patchPT({ fraisDivers: pt.fraisDivers.filter((l) => l.id !== idL) });
  }

  function addATP() {
    patchPT({
      atpTemp: [
        ...pt.atpTemp,
        { id: uid(), debut: null, fin: null, heuresParJour: 2, tauxHoraire: 20, facteurJours: 412 },
      ],
    });
  }
  function patchATP(idL: string, patch: Partial<ATPTempPeriode>) {
    patchPT({ atpTemp: pt.atpTemp.map((l) => (l.id === idL ? { ...l, ...patch } : l)) });
  }
  function delATP(idL: string) {
    patchPT({ atpTemp: pt.atpTemp.filter((l) => l.id !== idL) });
  }
  function patchPGPA(patch: Partial<PGPAData>) {
    patchPT({ pgpa: { ...pt.pgpa, ...patch } });
  }
  function addPGPAPeriode() {
    patchPGPA({
      periodes: [...pt.pgpa.periodes, { id: uid(), debut: null, fin: null, perte: 0 }],
    });
  }
  function patchPGPAPeriode(idL: string, patch: Partial<PGPAPeriode>) {
    patchPGPA({
      periodes: pt.pgpa.periodes.map((l) => (l.id === idL ? { ...l, ...patch } : l)),
    });
  }
  function delPGPAPeriode(idL: string) {
    patchPGPA({ periodes: pt.pgpa.periodes.filter((l) => l.id !== idL) });
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header>
        <div className="text-xs font-display font-semibold text-primary tracking-wide">
          PAGE 2 — PRÉJUDICES PATRIMONIAUX TEMPORAIRES
        </div>
        <h1 className="mt-1 text-2xl font-display font-semibold">
          Dépenses de santé, ATP, PGPA
        </h1>
      </header>

      <Section
        title="Dépenses de santé actuelles — ponctuelles (DSA)"
        description="Une ligne par facture, revalorisée à la date de liquidation."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Dépense</TableHead>
                <TableHead>Dépense revalorisée</TableHead>
                <TableHead>TP</TableHead>
                <TableHead>TP revalorisé</TableHead>
                <TableHead>Reste</TableHead>
                <TableHead>Revalorisation</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pt.dsaPonctuelles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                    Aucune dépense ponctuelle.
                  </TableCell>
                </TableRow>
              )}
              {pt.dsaPonctuelles.map((l) => {
                const calc = dsaPCalc.lignes.find((x) => x.id === l.id);
                return (
                  <TableRow key={l.id} className="vp-row-alt">
                    <TableCell className="w-40">
                      <Input type="date" value={l.date ?? ""} onChange={(e) => patchDSAP(l.id, { date: e.target.value || null })} />
                    </TableCell>
                    <TableCell>
                      <Input value={l.libelle} onChange={(e) => patchDSAP(l.id, { libelle: e.target.value })} />
                    </TableCell>
                    <TableCell className="w-28">
                      <Input type="number" min={0} step="0.01" value={l.depense} onChange={(e) => patchDSAP(l.id, { depense: numOr0(e.target.value) })} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatEuros(calc?.depenseRevalorisee ?? 0)}</TableCell>
                    <TableCell className="w-28">
                      <Input type="number" min={0} step="0.01" value={l.tiersPayeur} onChange={(e) => patchDSAP(l.id, { tiersPayeur: numOr0(e.target.value) })} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatEuros(calc?.tpRevalorise ?? 0)}</TableCell>
                    <TableCell className="font-medium">{formatEuros(calc?.resteRevalorise ?? 0)}</TableCell>
                    <TableCell className="w-36">
                      <ModeRevaloSelect value={l.modeRevalo} onChange={(v) => patchDSAP(l.id, { modeRevalo: v })} />
                    </TableCell>
                    <TableCell><IconDelete onClick={() => delDSAP(l.id)} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Button size="sm" variant="outline" onClick={addDSAP}><Plus className="w-4 h-4 mr-2" />Ajouter une dépense</Button>
          <TotalPill label="Total DSA ponctuelles (dépense revalorisée)" value={dsaPCalc.totalDepenseRevalorisee} />
        </div>
      </Section>

      <Section
        title="Dépenses de santé actuelles — récurrentes"
        description="Ex. transports, séances de kiné, avec une périodicité."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Début</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Périodicité</TableHead>
                <TableHead>Dépense revalorisée</TableHead>
                <TableHead>TP total</TableHead>
                <TableHead>TP revalorisé</TableHead>
                <TableHead>Reste</TableHead>
                <TableHead>Revalo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pt.dsaRecurrentes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-6">Aucune dépense récurrente.</TableCell>
                </TableRow>
              )}
              {pt.dsaRecurrentes.map((l) => {
                const calc = dsaRCalc.lignes.find((x) => x.id === l.id);
                return (
                  <TableRow key={l.id} className="vp-row-alt">
                    <TableCell className="w-40"><Input type="date" value={l.debut ?? ""} onChange={(e) => patchDSAR(l.id, { debut: e.target.value || null })} /></TableCell>
                    <TableCell className="w-40"><Input type="date" value={l.fin ?? ""} onChange={(e) => patchDSAR(l.id, { fin: e.target.value || null })} /></TableCell>
                    <TableCell><Input value={l.libelle} onChange={(e) => patchDSAR(l.id, { libelle: e.target.value })} /></TableCell>
                    <TableCell className="w-24"><Input type="number" min={0} step="0.01" value={l.montant} onChange={(e) => patchDSAR(l.id, { montant: numOr0(e.target.value) })} /></TableCell>
                    <TableCell className="w-28">
                      <Select value={l.periodicite} onValueChange={(v) => patchDSAR(l.id, { periodicite: v as Periodicite })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="jour">Jour</SelectItem>
                          <SelectItem value="semaine">Semaine</SelectItem>
                          <SelectItem value="mois">Mois</SelectItem>
                          <SelectItem value="an">Année</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatEuros(calc?.depenseRevalorisee ?? 0)}</TableCell>
                    <TableCell className="w-24"><Input type="number" min={0} step="0.01" value={l.tiersPayeur} onChange={(e) => patchDSAR(l.id, { tiersPayeur: numOr0(e.target.value) })} /></TableCell>
                    <TableCell className="text-muted-foreground">{formatEuros(calc?.tpRevalorise ?? 0)}</TableCell>
                    <TableCell className="font-medium">{formatEuros(calc?.resteRevalorise ?? 0)}</TableCell>
                    <TableCell className="w-32"><ModeRevaloSelect value={l.modeRevalo} onChange={(v) => patchDSAR(l.id, { modeRevalo: v })} /></TableCell>
                    <TableCell><IconDelete onClick={() => delDSAR(l.id)} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Button size="sm" variant="outline" onClick={addDSAR}><Plus className="w-4 h-4 mr-2" />Ajouter une dépense récurrente</Button>
          <TotalPill label="Total DSA récurrentes (dépense revalorisée)" value={dsaRCalc.totalDepenseRevalorisee} />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Recap label="Total DSA (dépense revalorisée)" value={formatEuros(totalDSAmontant)} />
          <Recap label="Créance tiers payeur (revalorisée)" value={formatEuros(totalDSAtp)} />
          <Recap label="Part victime" value={formatEuros(dsaRep.victime)} accent="victime" />
        </div>
      </Section>

      <Section
        title="Assistance tierce personne — temporaire"
        description="Montant = taux horaire × heures/jour × jours × (facteur / 365). Facteur usuel 412 pour tenir compte des congés et jours fériés."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Début</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>h/j</TableHead>
                <TableHead>Taux €/h</TableHead>
                <TableHead>Facteur</TableHead>
                <TableHead>Jours</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pt.atpTemp.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Aucune période d'ATP temporaire.</TableCell></TableRow>
              )}
              {pt.atpTemp.map((l) => {
                const calc = atpCalc.lignes.find((x) => x.id === l.id);
                return (
                  <TableRow key={l.id} className="vp-row-alt">
                    <TableCell className="w-40"><Input type="date" value={l.debut ?? ""} onChange={(e) => patchATP(l.id, { debut: e.target.value || null })} /></TableCell>
                    <TableCell className="w-40"><Input type="date" value={l.fin ?? ""} onChange={(e) => patchATP(l.id, { fin: e.target.value || null })} /></TableCell>
                    <TableCell className="w-20"><Input type="number" min={0} step="0.5" value={l.heuresParJour} onChange={(e) => patchATP(l.id, { heuresParJour: numOr0(e.target.value) })} /></TableCell>
                    <TableCell className="w-24"><Input type="number" min={0} step="0.01" value={l.tauxHoraire} onChange={(e) => patchATP(l.id, { tauxHoraire: numOr0(e.target.value) })} /></TableCell>
                    <TableCell className="w-24"><Input type="number" min={0} step="1" value={l.facteurJours} onChange={(e) => patchATP(l.id, { facteurJours: numOr0(e.target.value) })} /></TableCell>
                    <TableCell className="text-muted-foreground">{calc?.jours ?? "—"}</TableCell>
                    <TableCell className="font-medium">{formatEuros(calc?.montant ?? 0)}</TableCell>
                    <TableCell><IconDelete onClick={() => delATP(l.id)} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Button size="sm" variant="outline" onClick={addATP}><Plus className="w-4 h-4 mr-2" />Ajouter une période</Button>
          <TotalPill label="Total ATP temporaire" value={atpCalc.total} />
        </div>
        <div className="mt-3">
          <Note>Dette du responsable ATP : {formatEuros(detteATP)}. Poste non partagé avec un tiers payeur (sauf cas particulier — à traiter dans le champ « autres »).</Note>
        </div>
      </Section>

      <Section
        title="Pertes de gains professionnels actuels (PGPA)"
        description="3 méthodes au choix : revenu de référence actualisé, sommes par périodes, ou forfait."
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Méthode de calcul">
            <Select value={pt.pgpa.methode} onValueChange={(v) => patchPGPA({ methode: v as PGPAMethode })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reference">Revenu de référence actualisé</SelectItem>
                <SelectItem value="periodes">Périodes de perte</SelectItem>
                <SelectItem value="forfait">Forfait</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Indemnités journalières perçues (TP)" hint="Créance du tiers payeur.">
            <Input type="number" min={0} step="0.01" value={pt.pgpa.ij} onChange={(e) => patchPGPA({ ij: numOr0(e.target.value) })} />
          </Field>
        </div>

        {pt.pgpa.methode === "reference" && (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Field label="Revenu annuel net de référence (€)">
              <Input type="number" min={0} step="0.01" value={pt.pgpa.revenuReference} onChange={(e) => patchPGPA({ revenuReference: numOr0(e.target.value) })} />
            </Field>
            <Field label="Année de référence">
              <Input type="number" min={2003} max={2030} step={1} value={pt.pgpa.anneeReference ?? ""} onChange={(e) => patchPGPA({ anneeReference: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Indice d'actualisation">
              <Select value={pt.pgpa.indice} onValueChange={(v) => patchPGPA({ indice: v as IndiceActualisation })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ipc">IPC</SelectItem>
                  <SelectItem value="smic">SMIC horaire</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Début arrêt"><Input type="date" value={pt.pgpa.debut ?? ""} onChange={(e) => patchPGPA({ debut: e.target.value || null })} /></Field>
            <Field label="Fin arrêt"><Input type="date" value={pt.pgpa.fin ?? ""} onChange={(e) => patchPGPA({ fin: e.target.value || null })} /></Field>
          </div>
        )}

        {pt.pgpa.methode === "periodes" && (
          <div className="mt-5 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Début</TableHead><TableHead>Fin</TableHead><TableHead>Perte nette (€)</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pt.pgpa.periodes.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Aucune période.</TableCell></TableRow>
                )}
                {pt.pgpa.periodes.map((p) => (
                  <TableRow key={p.id} className="vp-row-alt">
                    <TableCell className="w-40"><Input type="date" value={p.debut ?? ""} onChange={(e) => patchPGPAPeriode(p.id, { debut: e.target.value || null })} /></TableCell>
                    <TableCell className="w-40"><Input type="date" value={p.fin ?? ""} onChange={(e) => patchPGPAPeriode(p.id, { fin: e.target.value || null })} /></TableCell>
                    <TableCell className="w-40"><Input type="number" min={0} step="0.01" value={p.perte} onChange={(e) => patchPGPAPeriode(p.id, { perte: numOr0(e.target.value) })} /></TableCell>
                    <TableCell><IconDelete onClick={() => delPGPAPeriode(p.id)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Button className="mt-3" size="sm" variant="outline" onClick={addPGPAPeriode}><Plus className="w-4 h-4 mr-2" />Ajouter une période</Button>
          </div>
        )}

        {pt.pgpa.methode === "forfait" && (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Montant forfaitaire (€)">
              <Input type="number" min={0} step="0.01" value={pt.pgpa.forfait} onChange={(e) => patchPGPA({ forfait: numOr0(e.target.value) })} />
            </Field>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Recap label="Perte totale" value={formatEuros(pgpaCalc.perte)} />
          <Recap label="Tiers payeur (IJ)" value={formatEuros(pgpaCalc.tiersPayeur)} accent="tiers" />
          <Recap label="Reste à charge" value={formatEuros(pgpaCalc.resteACharge)} />
          <Recap label="Part victime après répartition" value={formatEuros(pgpaRep.victime)} accent="victime" />
        </div>
      </Section>
    </div>
  );
}

function numOr0(v: string): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

function ModeRevaloSelect({ value, onChange }: { value: ModeRevalo; onChange: (v: ModeRevalo) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ModeRevalo)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="non">Sans</SelectItem>
        <SelectItem value="annuel">IPC annuel</SelectItem>
        <SelectItem value="mensuel">IPC mensuel</SelectItem>
      </SelectContent>
    </Select>
  );
}

function IconDelete({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <Trash2 className="w-4 h-4 text-destructive" />
    </Button>
  );
}

function TotalPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <div className="text-[11px] text-muted-foreground font-display uppercase tracking-wide">{label}</div>
      <div className="font-display font-semibold text-lg">{formatEuros(value)}</div>
    </div>
  );
}

function Recap({ label, value, accent }: { label: string; value: string; accent?: "victime" | "tiers" }) {
  const cls = accent === "victime" ? "text-victime" : accent === "tiers" ? "text-tiers" : "text-foreground";
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-display">{label}</div>
      <div className={`mt-0.5 font-display font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
