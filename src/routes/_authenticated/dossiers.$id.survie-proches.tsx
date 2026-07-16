import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useDossier } from "@/hooks/useDossier";
import { Field, Note, Section } from "@/components/vp/Field";
import { Input } from "@/components/ui/input";
import { MontantInput } from "@/components/vp/MontantInput";
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
  calculerPerteRevenusSurvie,
  detteResponsable,
  formatEuros,
  repartition,
  totalAffectionSurvie,
  totalPEPSurvie,
  type FraisDivers,
  type PostesSurvie,
  type ProcheSurvie,
  type Sexe,
} from "@/lib/calculs";
import { FourchetteAffectionHint } from "@/components/vp/FourchetteHint";
import { REFERENTIEL } from "@/data/referentiel_evaluation";

export const Route = createFileRoute("/_authenticated/dossiers/$id/survie-proches")({
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
  const ps = dossier.postesSurvie;
  const ctx = { dateLiquidation: dossier.dateLiquidation, bareme: dossier.bareme };

  const perte = useMemo(() => calculerPerteRevenusSurvie(ps.proches, ctx), [ps.proches, ctx.dateLiquidation, ctx.bareme]);
  const frais = useMemo(() => calculerFraisDivers(ps.fraisDivers), [ps.fraisDivers]);
  const affection = useMemo(() => totalAffectionSurvie(ps.proches), [ps.proches]);
  const pep = useMemo(() => totalPEPSurvie(ps.proches), [ps.proches]);

  function patch(p: Partial<PostesSurvie>) {
    update({ postesSurvie: { ...dossier!.postesSurvie, ...p } });
  }
  function addProche() {
    patch({
      proches: [...ps.proches, {
        id: uid(), prenom: "", lien: "conjoint", lienReferentiel: "", dateNaissance: null, sexe: "I",
        perteRevenusAnnuelle: 0, perteRevenusTP: 0, affection: 0, pep: 0,
      }],
    });
  }
  function patchProche(pid: string, p: Partial<ProcheSurvie>) {
    patch({ proches: ps.proches.map((x) => (x.id === pid ? { ...x, ...p } : x)) });
  }
  function delProche(pid: string) {
    patch({ proches: ps.proches.filter((x) => x.id !== pid) });
  }

  function addFrais() {
    patch({ fraisDivers: [...ps.fraisDivers, { id: uid(), libelle: "", montant: 0, tiersPayeur: 0 }] });
  }
  function patchFrais(fid: string, p: Partial<FraisDivers>) {
    patch({ fraisDivers: ps.fraisDivers.map((x) => (x.id === fid ? { ...x, ...p } : x)) });
  }
  function delFrais(fid: string) {
    patch({ fraisDivers: ps.fraisDivers.filter((x) => x.id !== fid) });
  }

  const dettePerte = detteResponsable(perte.totalCapital, dossier.fFaute, dossier.fChance);
  const repPerte = repartition(perte.totalCapital, perte.totalTP, dettePerte);
  const detteFrais = detteResponsable(frais.totalMontant, dossier.fFaute, dossier.fChance);
  const repFrais = repartition(frais.totalMontant, frais.totalTP, detteFrais);
  const detteAff = detteResponsable(affection, dossier.fFaute, dossier.fChance);
  const repAff = repartition(affection, 0, detteAff);
  const dettePEP = detteResponsable(pep, dossier.fFaute, dossier.fChance);
  const repPEP = repartition(pep, 0, dettePEP);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <header>
        <div className="text-xs font-display font-semibold text-primary tracking-wide">
          PAGE 7 — VICTIMES INDIRECTES : SURVIE DE LA VICTIME DIRECTE
        </div>
        <h1 className="mt-1 text-2xl font-display font-semibold">
          Perte de revenus des proches, frais divers, affection, préjudice exceptionnel
        </h1>
      </header>

      <Section title="Proches concernés" description="Chaque proche est capitalisé en viager sur son propre âge et sexe.">
        <div className="flex justify-end mb-2">
          <Button size="sm" variant="outline" onClick={addProche}><Plus className="w-4 h-4 mr-1" /> Ajouter un proche</Button>
        </div>
        {ps.proches.length === 0 ? (
          <Note>Aucun proche renseigné.</Note>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prénom</TableHead>
                <TableHead>Lien</TableHead>
                <TableHead>Date naissance</TableHead>
                <TableHead>Sexe</TableHead>
                <TableHead>Perte annuelle (€)</TableHead>
                <TableHead>TP annuel (€)</TableHead>
                <TableHead>Affection (€)</TableHead>
                <TableHead>PEP (€)</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ps.proches.map((p) => (
                <TableRow key={p.id}>
                  <TableCell><Input value={p.prenom} onChange={(e) => patchProche(p.id, { prenom: e.target.value })} /></TableCell>
                  <TableCell><Input value={p.lien} onChange={(e) => patchProche(p.id, { lien: e.target.value })} /></TableCell>
                  <TableCell><Input type="date" value={p.dateNaissance ?? ""} onChange={(e) => patchProche(p.id, { dateNaissance: e.target.value || null })} /></TableCell>
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
                  <TableCell><MontantInput className="w-32" aria-label="Montant" value={p.perteRevenusAnnuelle} onChange={(v) => patchProche(p.id,{ perteRevenusAnnuelle: v ?? 0 })} /></TableCell>
                  <TableCell><MontantInput className="w-28" aria-label="Montant" value={p.perteRevenusTP} onChange={(v) => patchProche(p.id,{ perteRevenusTP: v ?? 0 })} /></TableCell>
                  <TableCell>
                    <Select value={p.lienReferentiel || "__none"} onValueChange={(v) => patchProche(p.id, { lienReferentiel: v === "__none" ? "" : v })}>
                      <SelectTrigger className="w-56"><SelectValue placeholder="Lien (référentiel)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— non renseigné —</SelectItem>
                        {REFERENTIEL.affectionDeces.map((f) => (
                          <SelectItem key={f.code} value={f.code}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <MontantInput className="w-28 mt-1" aria-label="Montant" value={p.affection} onChange={(v) => patchProche(p.id,{ affection: v ?? 0 })} />
                    <div className="mt-1"><FourchetteAffectionHint code={p.lienReferentiel ?? ""} /></div>
                  </TableCell>
                  <TableCell><MontantInput className="w-28" aria-label="Montant" value={p.pep} onChange={(v) => patchProche(p.id,{ pep: v ?? 0 })} /></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => delProche(p.id)}><Trash2 className="w-4 h-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <Section id="poste-perte-proches" title="Perte de revenus capitalisée">
        {perte.lignes.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proche</TableHead>
                <TableHead>Âge</TableHead>
                <TableHead>Rente</TableHead>
                <TableHead>PER</TableHead>
                <TableHead>Capital</TableHead>
                <TableHead>Capital TP</TableHead>
                <TableHead>Reste</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perte.lignes.map((l) => (
                <TableRow key={l.procheId}>
                  <TableCell>{l.prenom || "—"}</TableCell>
                  <TableCell>{l.age}</TableCell>
                  <TableCell>{formatEuros(l.renteAnnuelle)}</TableCell>
                  <TableCell>{l.per.toFixed(3)}</TableCell>
                  <TableCell>{formatEuros(l.capital)}</TableCell>
                  <TableCell>{formatEuros(l.capitalTP)}</TableCell>
                  <TableCell>{formatEuros(l.reste)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Recap label="Capital total" value={formatEuros(perte.totalCapital)} />
          <Recap label="Dette responsable" value={formatEuros(dettePerte)} />
          <Recap label="Part victime (proches)" value={formatEuros(repPerte.victime)} accent="victime" />
        </div>
      </Section>

      <Section title="Frais divers des proches">
        <div className="flex justify-end mb-2">
          <Button size="sm" variant="outline" onClick={addFrais}><Plus className="w-4 h-4 mr-1" /> Ajouter</Button>
        </div>
        {ps.fraisDivers.length === 0 ? (
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
              {ps.fraisDivers.map((f) => (
                <TableRow key={f.id}>
                  <TableCell><Input value={f.libelle} onChange={(e) => patchFrais(f.id, { libelle: e.target.value })} /></TableCell>
                  <TableCell><MontantInput aria-label="Montant" value={f.montant} onChange={(v) => patchFrais(f.id,{ montant: v ?? 0 })} /></TableCell>
                  <TableCell><MontantInput aria-label="Montant" value={f.tiersPayeur} onChange={(v) => patchFrais(f.id,{ tiersPayeur: v ?? 0 })} /></TableCell>
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

      <Section title="Préjudice d'affection et PEP" description="Cumul des montants saisis par proche.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Recap label="Total affection" value={formatEuros(affection)} />
          <Recap label="Dette responsable" value={formatEuros(detteAff)} />
          <Recap label="Part victime (proches)" value={formatEuros(repAff.victime)} accent="victime" />
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Recap label="Total PEP" value={formatEuros(pep)} />
          <Recap label="Dette responsable" value={formatEuros(dettePEP)} />
          <Recap label="Part victime (proches)" value={formatEuros(repPEP.victime)} accent="victime" />
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
