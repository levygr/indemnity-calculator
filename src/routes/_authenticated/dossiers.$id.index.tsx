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
import type {
  BaremeType,
  FaitGenerateur,
  MethodeRente,
  PeriodeDFT,
  Sexe,
  TableMortalite,
} from "@/lib/calculs/types";
import { FourchetteDegreHint } from "@/components/vp/FourchetteHint";
import { RegimeVigilance } from "@/components/vp/RegimeVigilance";
import {
  ajouterJours,
  anneesRevolues,
  esperanceVieAnnees,
  esperanceVieJours,
  joursEntre,
  formatNombre,
} from "@/lib/calculs";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dossiers/$id/")({
  component: DossierPage,
});

const FAITS: Array<{ value: FaitGenerateur; label: string }> = [
  { value: "circulation", label: "Circulation" },
  { value: "medical", label: "Médical" },
  { value: "accident_travail", label: "Accident du travail" },
  { value: "maladie_pro", label: "Maladie professionnelle" },
  { value: "infraction_penale", label: "Infraction pénale" },
  { value: "terrorisme", label: "Terrorisme" },
  { value: "autre", label: "Autre" },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function DossierPage() {
  const { id } = Route.useParams();
  const { dossier, update } = useDossier(id);

  const calculs = useMemo(() => {
    if (!dossier) return null;
    const ageAccident = anneesRevolues(dossier.dateNaissance, dossier.dateAccident);
    const ageConso = anneesRevolues(dossier.dateNaissance, dossier.dateConsolidation);
    const ageLiq = anneesRevolues(dossier.dateNaissance, dossier.dateLiquidation);
    const dureeConso = joursEntre(dossier.dateAccident, dossier.dateConsolidation);
    const dureeConsoLiq = joursEntre(dossier.dateConsolidation, dossier.dateLiquidation);
    const evConsoAns = esperanceVieAnnees(ageConso, dossier.sexe, dossier.tableMortalite);
    const evConsoJ = esperanceVieJours(ageConso, dossier.sexe, dossier.tableMortalite);
    const evLiqAns = esperanceVieAnnees(ageLiq, dossier.sexe, dossier.tableMortalite);
    const evLiqJ = esperanceVieJours(ageLiq, dossier.sexe, dossier.tableMortalite);
    return { ageAccident, ageConso, ageLiq, dureeConso, dureeConsoLiq, evConsoAns, evConsoJ, evLiqAns, evLiqJ };
  }, [dossier]);

  if (!dossier || !calculs) return null;

  function addPeriodeDFT() {
    const list = [...dossier!.periodesDFT];
    const derniereFin = list.length ? list[list.length - 1].fin : null;
    const debut = derniereFin
      ? ajouterJours(derniereFin, 1)
      : dossier!.dateAccident
        ? dossier!.dftDebutLendemain
          ? ajouterJours(dossier!.dateAccident, 1)
          : dossier!.dateAccident
        : null;
    list.push({ id: uid(), debut, fin: null, taux: 1 });
    if (list.length > 13) list.pop();
    update({ periodesDFT: list });
  }

  function patchPeriode(pid: string, patch: Partial<PeriodeDFT>) {
    update({
      periodesDFT: dossier!.periodesDFT.map((p) => (p.id === pid ? { ...p, ...patch } : p)),
    });
  }

  function removePeriode(pid: string) {
    update({ periodesDFT: dossier!.periodesDFT.filter((p) => p.id !== pid) });
  }

  const finDerniere = dossier.periodesDFT[dossier.periodesDFT.length - 1]?.fin;
  const finDepasseConso =
    finDerniere && dossier.dateConsolidation && finDerniere > dossier.dateConsolidation;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <div className="text-xs font-display font-semibold text-primary tracking-wide">
          PAGE 1 — DOSSIER
        </div>
        <h1 className="mt-1 text-2xl font-display font-semibold">Informations du dossier</h1>
      </header>

      <Section title="Identification">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Référence du dossier" htmlFor="ref">
            <Input
              id="ref"
              value={dossier.reference}
              onChange={(e) => update({ reference: e.target.value })}
            />
          </Field>
          <Field label="Fait générateur">
            <Select
              value={dossier.faitGenerateur}
              onValueChange={(v) => update({ faitGenerateur: v as FaitGenerateur })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FAITS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Sexe de la victime directe"
            hint="Détermine la colonne utilisée dans la table de mortalité et le barème de capitalisation."
          >
            <Select value={dossier.sexe} onValueChange={(v) => update({ sexe: v as Sexe })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Féminin</SelectItem>
                <SelectItem value="M">Masculin</SelectItem>
                <SelectItem value="I">Indéterminé</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Table d'espérance de vie (information)"
            hint="Utilisée uniquement pour l'affichage de l'espérance de vie. La capitalisation repose sur le barème Gazette du Palais 2025, taux 0,5 %, selon le choix stationnaire ou prospectif ci-dessous."
          >
            <Select
              value={dossier.tableMortalite}
              onValueChange={(v) => update({ tableMortalite: v as TableMortalite })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2020-2022">Table 2020-2022</SelectItem>
                <SelectItem value="2023-2025">Table 2023-2025</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <RegimeVigilance faitGenerateur={dossier.faitGenerateur} id="regime-vigilance" />
        {dossier.sexe === "I" && (
          <div className="mt-4">
            <Note>
              Sexe indéterminé&nbsp;: utilisation de la valeur <em>Ensemble</em> pour
              la capitalisation stationnaire et l'espérance de vie, et d'une
              moyenne hommes/femmes pour les tables prospectives.
            </Note>
          </div>
        )}
      </Section>

      <Section title="Dates et âges">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Date de naissance" htmlFor="dob">
            <Input
              id="dob"
              type="date"
              value={dossier.dateNaissance ?? ""}
              onChange={(e) => update({ dateNaissance: e.target.value || null })}
            />
          </Field>
          <Field label="Date de l'accident" htmlFor="dacc">
            <Input
              id="dacc"
              type="date"
              value={dossier.dateAccident ?? ""}
              onChange={(e) => update({ dateAccident: e.target.value || null })}
            />
          </Field>
          <Field label="Date de consolidation" htmlFor="dcons">
            <Input
              id="dcons"
              type="date"
              value={dossier.dateConsolidation ?? ""}
              onChange={(e) => update({ dateConsolidation: e.target.value || null })}
            />
          </Field>
          <Field label="Date de liquidation" htmlFor="dliq">
            <Input
              id="dliq"
              type="date"
              value={dossier.dateLiquidation ?? ""}
              onChange={(e) => update({ dateLiquidation: e.target.value || null })}
            />
          </Field>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Recap label="Âge à l'accident" value={fmtInt(calculs.ageAccident, "ans")} />
          <Recap label="Âge à la consolidation" value={fmtInt(calculs.ageConso, "ans")} />
          <Recap label="Âge à la liquidation" value={fmtInt(calculs.ageLiq, "ans")} />
          <Recap label="Durée accident → consolidation" value={fmtInt(calculs.dureeConso, "j")} />
          <Recap label="Durée consolidation → liquidation" value={fmtInt(calculs.dureeConsoLiq, "j")} />
          <Recap
            label="EV à la consolidation"
            value={
              calculs.evConsoAns != null
                ? `${formatNombre(calculs.evConsoAns, 2)} ans (${calculs.evConsoJ} j)`
                : "—"
            }
          />
          <Recap
            label="EV à la liquidation"
            value={
              calculs.evLiqAns != null
                ? `${formatNombre(calculs.evLiqAns, 2)} ans (${calculs.evLiqJ} j)`
                : "—"
            }
          />
        </div>
      </Section>

      <Section title="Cotations et taux">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Field label="Taux de DFP / AIPP (%)" htmlFor="aipp">
            <Input
              id="aipp"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={dossier.tauxAIPP}
              onChange={(e) => update({ tauxAIPP: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="Souffrances endurées (/7)" htmlFor="se">
            <Input
              id="se"
              type="number"
              min={0}
              max={7}
              step={0.5}
              value={dossier.souffrancesEndurees}
              onChange={(e) => update({ souffrancesEndurees: Number(e.target.value) || 0 })}
            />
            <FourchetteDegreHint poste="SE" degre={dossier.souffrancesEndurees} />
          </Field>
          <Field label="Préj. esthétique temporaire (/7)" htmlFor="pet">
            <Input
              id="pet"
              type="number"
              min={0}
              max={7}
              step={0.5}
              value={dossier.esthetiqueTemp}
              onChange={(e) => update({ esthetiqueTemp: Number(e.target.value) || 0 })}
            />
            <FourchetteDegreHint poste="PET" degre={dossier.esthetiqueTemp} />
          </Field>
          <Field label="Préj. esthétique permanent (/7)" htmlFor="pep">
            <Input
              id="pep"
              type="number"
              min={0}
              max={7}
              step={0.5}
              value={dossier.esthetiquePerm}
              onChange={(e) => update({ esthetiquePerm: Number(e.target.value) || 0 })}
            />
            <FourchetteDegreHint poste="PEP" degre={dossier.esthetiquePerm} />
          </Field>
        </div>
      </Section>


      <Section title="Fractions de réduction">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Fraction — faute de la victime"
            hint="Fraction entre 0 et 1 appliquée à chaque poste (défaut 1 = pas de réduction)."
          >
            <Input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={dossier.fFaute}
              onChange={(e) => update({ fFaute: clamp01(Number(e.target.value)) })}
            />
          </Field>
          <Field
            label="Fraction — perte de chance"
            hint="Fraction entre 0 et 1. Multipliée avec la fraction de faute pour obtenir la dette du responsable."
          >
            <Input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={dossier.fChance}
              onChange={(e) => update({ fChance: clamp01(Number(e.target.value)) })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Barème de capitalisation">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Barème"
            hint="Barème de capitalisation Gazette du Palais 2025, taux 0,5 %. Stationnaire : tables INSEE 2020-2022. Prospectif : tables INSEE 2021-2121."
          >
            <Select
              value={dossier.bareme}
              onValueChange={(v) => update({ bareme: v as BaremeType })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stationnaire">Tables stationnaires</SelectItem>
                <SelectItem value="prospectif">Tables prospectives</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Méthode des rentes différées"
            hint="Habituelle : PER viager à l'âge du début de rente. Exacte : viager(liq) − temporaire(liq→début)."
          >
            <Select
              value={dossier.methodeRente}
              onValueChange={(v) => update({ methodeRente: v as MethodeRente })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="habituelle">Méthode habituelle</SelectItem>
                <SelectItem value="exacte">Méthode exacte</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Note>
            Taux 0,5&nbsp;% pour les deux barèmes. Les tables stationnaires sont
            fondées sur les données INSEE 2020-2022 (comme Gaz. Pal. 2025) avec
            âges supplémentaires et sexe indéterminé. Les tables prospectives
            reprennent Gaz. Pal. 2025 mais suivent une méthode de calcul
            différente.
          </Note>
        </div>
      </Section>

      <Section
        title="Périodes de DFT"
        description="Le DFT commence au choix le jour même de l'accident ou le lendemain. Les périodes doivent être chaînées et rester avant la date de consolidation."
      >
        <Field label="Début du DFT">
          <Select
            value={dossier.dftDebutLendemain ? "lendemain" : "meme"}
            onValueChange={(v) => update({ dftDebutLendemain: v === "lendemain" })}
          >
            <SelectTrigger className="w-full md:w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="meme">Le jour de l'accident</SelectItem>
              <SelectItem value="lendemain">Le lendemain de l'accident</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="mt-5 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Début</TableHead>
                <TableHead>Fin</TableHead>
                <TableHead>Taux (%)</TableHead>
                <TableHead>Jours</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dossier.periodesDFT.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-center py-6">
                    Aucune période. Cliquez sur « Ajouter une période » pour commencer.
                  </TableCell>
                </TableRow>
              )}
              {dossier.periodesDFT.map((p, i) => {
                const jours = joursEntre(p.debut, p.fin);
                const isFirst = i === 0;
                return (
                  <TableRow key={p.id} className="vp-row-alt">
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={p.debut ?? ""}
                        disabled={!isFirst}
                        onChange={(e) => patchPeriode(p.id, { debut: e.target.value || null })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={p.fin ?? ""}
                        onChange={(e) => {
                          const fin = e.target.value || null;
                          const list = dossier.periodesDFT.map((x) => (x.id === p.id ? { ...x, fin } : x));
                          // Recalibrage : chaque période suivante commence à fin + 1 j
                          for (let k = i + 1; k < list.length; k++) {
                            const prevFin = list[k - 1].fin;
                            list[k] = { ...list[k], debut: prevFin ? ajouterJours(prevFin, 1) : null };
                          }
                          update({ periodesDFT: list });
                        }}
                      />
                    </TableCell>
                    <TableCell className="w-28">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={Math.round(p.taux * 100)}
                        onChange={(e) => patchPeriode(p.id, { taux: clamp01(Number(e.target.value) / 100) })}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{jours ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => removePeriode(p.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={addPeriodeDFT}
            disabled={dossier.periodesDFT.length >= 13}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une période
          </Button>
          {finDepasseConso && (
            <div className="text-xs text-destructive">
              La dernière fin de période dépasse la date de consolidation.
            </div>
          )}
        </div>
      </Section>

      <Section title="Synthèse (aperçu)">
        <Note>
          Les postes des pages 2 à 7 seront ajoutés dans les prochaines phases de
          construction. Le moteur de calcul (revalorisation, capitalisation,
          répartition victime / tiers payeur) est déjà en place et testé.
        </Note>
      </Section>
    </div>
  );
}

function Recap({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/40 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-display">
        {label}
      </div>
      <div className="mt-0.5 font-display font-semibold text-foreground">{value}</div>
    </div>
  );
}

function fmtInt(v: number | null, unit: string) {
  return v == null ? "—" : `${v} ${unit}`;
}
function clamp01(v: number) {
  if (isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
