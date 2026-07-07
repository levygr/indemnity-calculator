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
  calculerFraisDivers,
  calculerPerteRevenusFoyer,
  detteResponsable,
  formatEuros,
  repartition,
  totalAffection,
  type FraisDivers,
  type LienProche,
  type PostesDeces,
  type Proche,
  type Sexe,
} from "@/lib/calculs";
import { FourchetteAffectionHint } from "@/components/vp/FourchetteHint";

export const Route = createFileRoute("/_authenticated/dossiers/$id/deces")({
  component: Page,
});

function uid() { return Math.random().toString(36).slice(2, 10); }
function n(v: string) { const x = Number(v); return isFinite(x) ? x : 0; }

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
  const pd = dossier.postesDeces;
  const ctx = { dateLiquidation: dossier.dateLiquidation, bareme: dossier.bareme, methodeRente: dossier.methodeRente };

  const foyer = useMemo(() => calculerPerteRevenusFoyer(pd, ctx), [pd, ctx.dateLiquidation, ctx.bareme, ctx.methodeRente]);
  const frais = useMemo(() => calculerFraisDivers(pd.fraisDivers), [pd.fraisDivers]);
  const affection = useMemo(() => totalAffection(pd.proches), [pd.proches]);

  function patch(p: Partial<PostesDeces>) {
    update({ postesDeces: { ...dossier!.postesDeces, ...p } });
  }
  function patchProche(pid: string, p: Partial<Proche>) {
    patch({ proches: pd.proches.map((x) => (x.id === pid ? { ...x, ...p } : x)) });
  }
  function addProche(lien: LienProche) {
    patch({
      proches: [...pd.proches, {
        id: uid(), lien, prenom: "", dateNaissance: null, sexe: "I",
        partFoyer: lien === "conjoint" || lien === "enfant" ? 1 : 0,
        ageFinEtudes: 25, affection: 0, pensionReversionAnnuelle: 0,
      }],
    });
  }
  function delProche(pid: string) {
    patch({ proches: pd.proches.filter((x) => x.id !== pid) });
  }

  function addFrais() {
    patch({ fraisDivers: [...pd.fraisDivers, { id: uid(), libelle: "", montant: 0, tiersPayeur: 0 }] });
  }
  function patchFrais(fid: string, p: Partial<FraisDivers>) {
    patch({ fraisDivers: pd.fraisDivers.map((x) => (x.id === fid ? { ...x, ...p } : x)) });
  }
  function delFrais(fid: string) {
    patch({ fraisDivers: pd.fraisDivers.filter((x) => x.id !== fid) });
  }

  // Répartitions poste par poste
  const obseques = Math.max(0, pd.obsequesMontant || 0);
  const detteObs = detteResponsable(obseques, dossier.fFaute, dossier.fChance);
  const repObs = repartition(obseques, Math.max(0, pd.obsequesTP || 0), detteObs);

  const detteFoyer = detteResponsable(foyer.totalCapital, dossier.fFaute, dossier.fChance);
  const repFoyer = repartition(foyer.totalCapital, foyer.totalTP, detteFoyer);

  const detteFrais = detteResponsable(frais.totalMontant, dossier.fFaute, dossier.fChance);
  const repFrais = repartition(frais.totalMontant, frais.totalTP, detteFrais);

  const acc = Math.max(0, pd.accompagnementFinDeVie || 0);
  const detteAcc = detteResponsable(acc, dossier.fFaute, dossier.fChance);
  const repAcc = repartition(acc, Math.max(0, pd.accompagnementTP || 0), detteAcc);

  const detteAff = detteResponsable(affection, dossier.fFaute, dossier.fChance);
  const repAff = repartition(affection, 0, detteAff);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header>
        <div className="text-xs font-display font-semibold text-primary tracking-wide">
          PAGE 6 — VICTIMES INDIRECTES : DÉCÈS
        </div>
        <h1 className="mt-1 text-2xl font-display font-semibold">
          Obsèques, perte de revenus du foyer, frais divers, accompagnement, affection
        </h1>
      </header>

      {/* Obsèques */}
      <Section title="Frais d'obsèques" description="Montant total (indépendant du droit de préférence de la victime directe).">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Field label="Montant (€)">
            <Input type="number" min={0} step="0.01" value={pd.obsequesMontant} onChange={(e) => patch({ obsequesMontant: n(e.target.value) })} />
          </Field>
          <Field label="Créance TP (€)">
            <Input type="number" min={0} step="0.01" value={pd.obsequesTP} onChange={(e) => patch({ obsequesTP: n(e.target.value) })} />
          </Field>
          <Recap label="Dette responsable" value={formatEuros(detteObs)} />
          <Recap label="Part victime (proches)" value={formatEuros(repObs.victime)} accent="victime" />
        </div>
      </Section>

      {/* Proches */}
      <Section title="Proches" description="Ajoutez chaque proche, son lien avec le défunt, sa date de naissance et son sexe. Les enfants sont capitalisés jusqu'à l'âge de fin d'études ; le conjoint en viager.">
        <div className="flex gap-2 mb-3">
          <Button size="sm" variant="outline" onClick={() => addProche("conjoint")}><Plus className="w-4 h-4 mr-1" /> Conjoint</Button>
          <Button size="sm" variant="outline" onClick={() => addProche("enfant")}><Plus className="w-4 h-4 mr-1" /> Enfant</Button>
          <Button size="sm" variant="outline" onClick={() => addProche("parent")}><Plus className="w-4 h-4 mr-1" /> Parent</Button>
          <Button size="sm" variant="outline" onClick={() => addProche("fratrie")}><Plus className="w-4 h-4 mr-1" /> Fratrie</Button>
          <Button size="sm" variant="outline" onClick={() => addProche("autre")}><Plus className="w-4 h-4 mr-1" /> Autre</Button>
        </div>
        {pd.proches.length === 0 ? (
          <Note>Aucun proche renseigné.</Note>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lien</TableHead>
                <TableHead>Prénom</TableHead>
                <TableHead>Date de naissance</TableHead>
                <TableHead>Sexe</TableHead>
                <TableHead>Part foyer</TableHead>
                <TableHead>Fin études</TableHead>
                <TableHead>Réversion (€/an)</TableHead>
                <TableHead>Affection (€)</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pd.proches.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="capitalize text-xs">{p.lien}</TableCell>
                  <TableCell>
                    <Input value={p.prenom} onChange={(e) => patchProche(p.id, { prenom: e.target.value })} />
                  </TableCell>
                  <TableCell>
                    <Input type="date" value={p.dateNaissance ?? ""} onChange={(e) => patchProche(p.id, { dateNaissance: e.target.value || null })} />
                  </TableCell>
                  <TableCell>
                    <Select value={p.sexe} onValueChange={(v) => patchProche(p.id, { sexe: v as Sexe })}>
                      <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="F">F</SelectItem>
                        <SelectItem value="M">M</SelectItem>
                        <SelectItem value="I">I</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} step="0.5" className="w-20"
                      value={p.partFoyer}
                      disabled={p.lien !== "conjoint" && p.lien !== "enfant"}
                      onChange={(e) => patchProche(p.id, { partFoyer: n(e.target.value) })} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} className="w-20"
                      value={p.ageFinEtudes}
                      disabled={p.lien !== "enfant"}
                      onChange={(e) => patchProche(p.id, { ageFinEtudes: n(e.target.value) })} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} step="0.01" className="w-28"
                      value={p.pensionReversionAnnuelle ?? 0}
                      disabled={p.lien !== "conjoint" && p.lien !== "enfant"}
                      onChange={(e) => patchProche(p.id, { pensionReversionAnnuelle: n(e.target.value) })} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min={0} step="0.01" className="w-28"
                      value={p.affection}
                      onChange={(e) => patchProche(p.id, { affection: n(e.target.value) })} />
                    <div className="mt-1"><FourchetteAffectionHint lien={p.lien} /></div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => delProche(p.id)}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="mt-3">
          <Note>Pension de réversion ou rente d'ayant droit (annuelle, €) : créance de l'organisme social, imputée sur la perte de revenus du foyer (art. L. 376-1 CSS).</Note>
        </div>
      </Section>

      {/* Perte revenus foyer */}
      <Section
        title="Perte de revenus du foyer"
        description="Perte annuelle du foyer = (revenus cumulés défunt + conjoint) × (1 − part consommée par le défunt) − revenus maintenus du conjoint. Calcul séquencé par périodes selon la sortie progressive des enfants."
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Field label="Revenu annuel net du défunt (€)">
            <Input type="number" min={0} step="0.01" value={pd.revenuAnnuelDefunt} onChange={(e) => patch({ revenuAnnuelDefunt: n(e.target.value) })} />
          </Field>
          <Field label="Revenu annuel net du conjoint survivant (€)">
            <Input type="number" min={0} step="0.01" value={pd.revenuAnnuelConjoint} onChange={(e) => patch({ revenuAnnuelConjoint: n(e.target.value) })} />
          </Field>
          <Field label="Part consommée par le défunt (0..1)" hint="Typiquement 0,3 pour couple + 2 enfants.">
            <Input type="number" min={0} max={1} step="0.05" value={pd.partConsommeeDefunt} onChange={(e) => patch({ partConsommeeDefunt: n(e.target.value) })} />
          </Field>
          <Recap label="Perte annuelle du foyer" value={formatEuros(foyer.perteAnnuelleFoyer)} />
        </div>

        {pd.revenuAnnuelDefunt > 0 && foyer.perteAnnuelleFoyer === 0 && (
          <div className="mt-3">
            <Note variant="warning">
              La perte annuelle du foyer est nulle malgré un revenu du défunt renseigné : vérifiez la part d'autoconsommation et le revenu maintenu du conjoint.
            </Note>
          </div>
        )}

        {foyer.periodes.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-display font-semibold text-muted-foreground mb-1">Détail par période</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Bornes (années depuis liquidation)</TableHead>
                  <TableHead>Âge conjoint</TableHead>
                  <TableHead>Membres présents</TableHead>
                  <TableHead>Capital période</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {foyer.periodes.map((p) => (
                  <TableRow key={p.index}>
                    <TableCell>{p.index}</TableCell>
                    <TableCell>{p.debut} → {p.fin == null ? "viager" : p.fin}</TableCell>
                    <TableCell>{p.ageConjointDebut ?? "—"}{p.ageConjointFin != null ? ` → ${p.ageConjointFin}` : (p.fin == null && p.ageConjointDebut != null ? " → ∞" : "")}</TableCell>
                    <TableCell className="text-xs">
                      {p.membres.map((m) => (
                        <div key={m.procheId}>
                          {(m.prenom || m.lien)} — part {(m.part * 100).toFixed(1)} %, rente {formatEuros(m.renteAnnuelle)}, PER {m.per.toFixed(3)}, cap {formatEuros(m.capital)}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="font-medium">{formatEuros(p.totalCapital)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {foyer.lignes.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-display font-semibold text-muted-foreground mb-1">Récapitulatif par proche</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proche</TableHead>
                  <TableHead>Âge (liq.)</TableHead>
                  <TableHead>Part P1</TableHead>
                  <TableHead>Rente P1</TableHead>
                  <TableHead>PER cumulé</TableHead>
                  <TableHead>Capital</TableHead>
                  <TableHead>Capital TP</TableHead>
                  <TableHead>Reste</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {foyer.lignes.map((l) => (
                  <TableRow key={l.procheId}>
                    <TableCell>{l.prenom || l.lien}</TableCell>
                    <TableCell>{l.age}</TableCell>
                    <TableCell>{(l.part * 100).toFixed(1)} %</TableCell>
                    <TableCell>{formatEuros(l.renteAnnuelle)}</TableCell>
                    <TableCell>{l.per.toFixed(3)}</TableCell>
                    <TableCell>{formatEuros(l.capital)}</TableCell>
                    <TableCell>{formatEuros(l.capitalTP)}</TableCell>
                    <TableCell className="font-medium">{formatEuros(l.reste)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Recap label="Capital total" value={formatEuros(foyer.totalCapital)} />
          <Recap label="Créance TP (réversion)" value={formatEuros(foyer.totalTP)} />
          <Recap label="Dette responsable" value={formatEuros(detteFoyer)} />
          <Recap label="Part victime (proches)" value={formatEuros(repFoyer.victime)} accent="victime" />
        </div>
        {ctx.dateLiquidation == null && (
          <div className="mt-3"><Note variant="warning">Renseignez la date de liquidation sur la page Dossier pour capitaliser.</Note></div>
        )}
      </Section>


      {/* Frais divers */}
      <Section title="Frais divers des proches" description="Frais exposés en lien avec le décès (voyages, hébergement, formalités…).">
        <div className="flex justify-end mb-2">
          <Button size="sm" variant="outline" onClick={addFrais}><Plus className="w-4 h-4 mr-1" /> Ajouter</Button>
        </div>
        {pd.fraisDivers.length === 0 ? (
          <Note>Aucun frais divers.</Note>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead>Montant (€)</TableHead>
                <TableHead>Créance TP (€)</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pd.fraisDivers.map((f) => (
                <TableRow key={f.id}>
                  <TableCell><Input value={f.libelle} onChange={(e) => patchFrais(f.id, { libelle: e.target.value })} /></TableCell>
                  <TableCell><Input type="number" min={0} step="0.01" value={f.montant} onChange={(e) => patchFrais(f.id, { montant: n(e.target.value) })} /></TableCell>
                  <TableCell><Input type="number" min={0} step="0.01" value={f.tiersPayeur} onChange={(e) => patchFrais(f.id, { tiersPayeur: n(e.target.value) })} /></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => delFrais(f.id)}><Trash2 className="w-4 h-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Recap label="Total frais" value={formatEuros(frais.totalMontant)} />
          <Recap label="Dette responsable" value={formatEuros(detteFrais)} />
          <Recap label="Part victime (proches)" value={formatEuros(repFrais.victime)} accent="victime" />
        </div>
      </Section>

      {/* Accompagnement */}
      <Section title="Accompagnement de fin de vie" description="Forfait indemnisant l'assistance apportée par les proches durant la fin de vie de la victime.">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Field label="Montant (€)">
            <Input type="number" min={0} step="0.01" value={pd.accompagnementFinDeVie} onChange={(e) => patch({ accompagnementFinDeVie: n(e.target.value) })} />
          </Field>
          <Field label="Créance TP (€)">
            <Input type="number" min={0} step="0.01" value={pd.accompagnementTP} onChange={(e) => patch({ accompagnementTP: n(e.target.value) })} />
          </Field>
          <Recap label="Dette responsable" value={formatEuros(detteAcc)} />
          <Recap label="Part victime (proches)" value={formatEuros(repAcc.victime)} accent="victime" />
        </div>
      </Section>

      {/* Affection */}
      <Section title="Préjudice d'affection" description="Cumul des montants d'affection saisis pour chaque proche.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Recap label="Total affection" value={formatEuros(affection)} />
          <Recap label="Dette responsable" value={formatEuros(detteAff)} />
          <Recap label="Part victime (proches)" value={formatEuros(repAff.victime)} accent="victime" />
        </div>
      </Section>
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
