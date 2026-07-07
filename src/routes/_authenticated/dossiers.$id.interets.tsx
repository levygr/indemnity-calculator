import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useDossier } from "@/hooks/useDossier";
import { Section } from "@/components/vp/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { calculerSynthese, formatEuros, hydraterDossier } from "@/lib/calculs";
import { listTauxLegal } from "@/lib/taux-legal.functions";
import {
  calculerLigneInterets,
  phasesPourLigne,
  defaultLigneInterets,
  LIBELLES_REGIME,
  TauxLegalManquantError,
  type CategorieCreancier,
  type LigneTauxLegal,
  type LigneInterets,
  type RegimeInterets,
  type ResultatInterets,
} from "@/lib/calculs/interets";
import { formatDateFR } from "@/lib/calculs/format";
import type { DossierData } from "@/lib/calculs/types";
import { AlertTriangle, ChevronDown, ExternalLink, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dossiers/$id/interets")({
  component: Page,
});

type CalcResult =
  | { ok: true; value: ResultatInterets }
  | { ok: false; error: string }
  | { ok: false; error: "incomplet" };

function calc(ligne: LigneInterets, taux: LigneTauxLegal[]): CalcResult {
  if (!ligne.dateDebut || !ligne.dateFin) return { ok: false, error: "incomplet" };
  const phases = phasesPourLigne(ligne);
  if (!phases) return { ok: false, error: "incomplet" };
  try {
    return {
      ok: true,
      value: calculerLigneInterets({
        base: ligne.base,
        dateDebut: ligne.dateDebut,
        dateFin: ligne.dateFin,
        phases,
        anatocisme: ligne.anatocisme,
        dateAnatocisme: ligne.anatocisme ? ligne.dateAnatocisme : null,
        categorieCreancier: ligne.categorieCreancier,
        taux,
      }),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof TauxLegalManquantError ? e.message : (e as Error).message,
    };
  }
}

function chevauchement(a: LigneInterets, b: LigneInterets): boolean {
  if (!a.dateDebut || !a.dateFin || !b.dateDebut || !b.dateFin) return false;
  if (a.base !== b.base) return false;
  return a.dateDebut <= b.dateFin && b.dateDebut <= a.dateFin;
}

function Page() {
  const { id } = Route.useParams();
  const { dossier, update } = useDossier(id);

  const synthese = useMemo(
    () => (dossier ? calculerSynthese(hydraterDossier(dossier as unknown as Record<string, unknown>)) : null),
    [dossier],
  );

  const fetchTaux = useServerFn(listTauxLegal);
  const { data: taux, isLoading: loadingTaux, isError } = useQuery({
    queryKey: ["taux_legal"],
    queryFn: () => fetchTaux(),
  });

  if (!dossier) {
    return <div className="p-8">Chargement…</div>;
  }

  const lignes = dossier.lignesInterets;
  const soldeVictime = synthese?.soldeVictime ?? 0;

  const updateLigne = (idx: number, patch: Partial<LigneInterets>) => {
    update((prev: DossierData) => ({
      ...prev,
      lignesInterets: prev.lignesInterets.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    }));
  };

  const addLigne = () => {
    update((prev: DossierData) => ({
      ...prev,
      lignesInterets: [
        ...prev.lignesInterets,
        {
          ...defaultLigneInterets(crypto.randomUUID()),
          libelle: `Ligne ${prev.lignesInterets.length + 1}`,
          base: soldeVictime,
          dateFin: (prev.dateLiquidation as string | null) ?? new Date().toISOString().slice(0, 10),
        },
      ],
    }));
  };

  const supprimerLigne = (idx: number) => {
    update((prev: DossierData) => ({
      ...prev,
      lignesInterets: prev.lignesInterets.filter((_, i) => i !== idx),
    }));
  };

  const resultats = lignes.map((l) => (taux ? calc(l, taux as LigneTauxLegal[]) : null));
  const totalGeneral = resultats.reduce(
    (acc, r) => acc + (r && r.ok ? r.value.totalInterets : 0),
    0,
  );

  // Chevauchements de bases identiques
  const chevauchements: string[] = [];
  for (let i = 0; i < lignes.length; i++) {
    for (let j = i + 1; j < lignes.length; j++) {
      if (chevauchement(lignes[i], lignes[j])) {
        chevauchements.push(
          `« ${lignes[i].libelle || `Ligne ${i + 1}`} » et « ${lignes[j].libelle || `Ligne ${j + 1}`} »`,
        );
      }
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Intérêts au taux légal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Solde revenant à la victime (synthèse) : <strong>{formatEuros(soldeVictime)}</strong>
        </p>
      </div>

      <Alert>
        <AlertTitle>Régimes d'intérêts en dommage corporel</AlertTitle>
        <AlertDescription className="text-sm space-y-1">
          <p><strong>Avant jugement</strong> : intérêts au taux légal simple ou doublé (Badinter, art. L. 211-13 C. assur.) sur les périodes fixées par la décision, capitalisables sur demande (art. 1343-2 C. civ.).</p>
          <p><strong>Après jugement</strong> : intérêts de plein droit sur la condamnation (art. 1231-7 C. civ.), majorés de <strong>+5 points</strong> deux mois après que la décision est devenue exécutoire (art. L. 313-3 C. mon. fin.) ; en matière Badinter, taux × 1,5 puis × 2 en cas de non-règlement (art. L. 211-17 C. assur.).</p>
          <p>Ces intérêts peuvent se cumuler dans un même dossier.</p>
        </AlertDescription>
      </Alert>

      {loadingTaux ? (
        <p className="text-sm text-muted-foreground">Chargement des taux…</p>
      ) : isError ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Taux inaccessibles</AlertTitle>
          <AlertDescription>Impossible de charger les taux d'intérêt légal.</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        {lignes.map((ligne, idx) => (
          <LigneCard
            key={ligne.id}
            ligne={ligne}
            resultat={resultats[idx]}
            onChange={(patch) => updateLigne(idx, patch)}
            onSupprimer={() => supprimerLigne(idx)}
          />
        ))}
      </div>

      <Button onClick={addLigne} variant="outline">
        <Plus className="w-4 h-4 mr-2" /> Ajouter une ligne d'intérêts
      </Button>

      {chevauchements.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cumul à vérifier</AlertTitle>
          <AlertDescription className="text-sm">
            Lignes se chevauchant sur la même base — vérifiez que ce cumul correspond bien à la décision :
            <ul className="list-disc pl-5 mt-1">
              {chevauchements.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {lignes.length > 0 && (
        <Section title="Récapitulatif">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead>Régime</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Capitalisation</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lignes.map((l, i) => {
                const r = resultats[i];
                return (
                  <TableRow key={l.id}>
                    <TableCell>{l.libelle || `Ligne ${i + 1}`}</TableCell>
                    <TableCell className="text-xs">{LIBELLES_REGIME[l.regime]}</TableCell>
                    <TableCell className="text-xs">
                      {l.dateDebut ? formatDateFR(l.dateDebut) : "—"} → {l.dateFin ? formatDateFR(l.dateFin) : "—"}
                    </TableCell>
                    <TableCell>{l.anatocisme ? "Oui" : "Non"}</TableCell>
                    <TableCell className="text-right">
                      {r && r.ok ? formatEuros(r.value.totalInterets) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t pt-3 mt-3">
            <span className="font-display font-semibold">Total général des intérêts</span>
            <span className="font-display font-semibold text-lg">{formatEuros(totalGeneral)}</span>
          </div>
        </Section>
      )}
    </div>
  );
}

function LigneCard({
  ligne, resultat, onChange, onSupprimer,
}: {
  ligne: LigneInterets;
  resultat: CalcResult | null;
  onChange: (patch: Partial<LigneInterets>) => void;
  onSupprimer: () => void;
}) {
  const total = resultat && resultat.ok ? resultat.value.totalInterets : null;

  return (
    <Collapsible defaultOpen className="border rounded-lg bg-card">
      <div className="flex items-center gap-2 p-3 border-b">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm"><ChevronDown className="w-4 h-4" /></Button>
        </CollapsibleTrigger>
        <Input
          value={ligne.libelle}
          onChange={(e) => onChange({ libelle: e.target.value })}
          placeholder="Libellé (ex. doublement sur l'indemnité avant jugement)"
          className="flex-1"
        />
        <div className="text-sm text-muted-foreground shrink-0 min-w-[8rem] text-right">
          {total !== null ? formatEuros(total) : resultat && !resultat.ok && resultat.error !== "incomplet" ? (
            <span className="text-destructive">Erreur</span>
          ) : "—"}
        </div>
        <Button variant="ghost" size="sm" onClick={onSupprimer}><Trash2 className="w-4 h-4" /></Button>
      </div>
      <CollapsibleContent>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Régime</Label>
              <Select value={ligne.regime} onValueChange={(v) => onChange({ regime: v as RegimeInterets })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="taux_legal">{LIBELLES_REGIME.taux_legal}</SelectItem>
                  <SelectItem value="badinter_avant">{LIBELLES_REGIME.badinter_avant}</SelectItem>
                  <SelectItem value="decision_5pts">{LIBELLES_REGIME.decision_5pts}</SelectItem>
                  <SelectItem value="badinter_apres">{LIBELLES_REGIME.badinter_apres}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Catégorie de créancier</Label>
              <Select value={ligne.categorieCreancier} onValueChange={(v) => onChange({ categorieCreancier: v as CategorieCreancier })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="particulier">Personne physique (non professionnel)</SelectItem>
                  <SelectItem value="autres">Autres cas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Base (€)</Label>
              <Input
                type="number"
                value={ligne.base}
                onChange={(e) => onChange({ base: Number(e.target.value) })}
                inputMode="decimal"
              />
            </div>
            <div />
            <div>
              <Label>Date de début (fixée par la décision)</Label>
              <Input type="date" value={ligne.dateDebut ?? ""} onChange={(e) => onChange({ dateDebut: e.target.value || null })} />
            </div>
            <div>
              <Label>Date de fin</Label>
              <Input type="date" value={ligne.dateFin ?? ""} onChange={(e) => onChange({ dateFin: e.target.value || null })} />
            </div>

            {ligne.regime === "decision_5pts" && (
              <>
                <div>
                  <Label>Date de la décision</Label>
                  <Input type="date" value={ligne.dateDecision ?? ""} onChange={(e) => onChange({ dateDecision: e.target.value || null })} />
                </div>
                <div>
                  <Label>Date à laquelle la décision est devenue exécutoire</Label>
                  <Input type="date" value={ligne.dateExecutoire ?? ""} onChange={(e) => onChange({ dateExecutoire: e.target.value || null })} />
                </div>
                <div>
                  <Label>Délai avant majoration (mois)</Label>
                  <Input type="number" value={ligne.delaiMajorationMois} onChange={(e) => onChange({ delaiMajorationMois: Number(e.target.value) })} />
                </div>
              </>
            )}

            {ligne.regime === "badinter_apres" && (
              <>
                <div>
                  <Label>Date de la décision</Label>
                  <Input type="date" value={ligne.dateDecision ?? ""} onChange={(e) => onChange({ dateDecision: e.target.value || null })} />
                </div>
                <div>
                  <Label>Délai avant passage à × 1,5 (mois)</Label>
                  <Input type="number" value={ligne.delaiBadinter1Mois} onChange={(e) => onChange({ delaiBadinter1Mois: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Délai avant passage à × 2 (mois)</Label>
                  <Input type="number" value={ligne.delaiBadinter2Mois} onChange={(e) => onChange({ delaiBadinter2Mois: Number(e.target.value) })} />
                </div>
              </>
            )}
          </div>

          {(ligne.regime === "decision_5pts" || ligne.regime === "badinter_apres") && (
            <p className="text-xs text-muted-foreground">
              Vérifier les dates et délais retenus contre le texte de la décision.
            </p>
          )}

          <div className="space-y-2">
            <label className="flex items-start gap-2">
              <Checkbox checked={ligne.anatocisme} onCheckedChange={(v) => onChange({ anatocisme: !!v })} />
              <span className="text-sm">
                <strong>Capitalisation des intérêts</strong> (art. 1343-2 C. civ.)
              </span>
            </label>
            {ligne.anatocisme && (
              <div className="pl-6">
                <Label>Date de la demande de capitalisation</Label>
                <Input
                  type="date"
                  value={ligne.dateAnatocisme ?? ""}
                  onChange={(e) => onChange({ dateAnatocisme: e.target.value || null })}
                  className="w-56"
                />
              </div>
            )}
          </div>

          {resultat && !resultat.ok && resultat.error !== "incomplet" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Taux légal manquant</AlertTitle>
              <AlertDescription>
                {resultat.error}
                <div className="mt-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/taux-legal">
                      Aller à l'écran Taux légal <ExternalLink className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {resultat && resultat.ok && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Période</TableHead>
                    <TableHead>Taux légal</TableHead>
                    <TableHead>×</TableHead>
                    <TableHead>+ pts</TableHead>
                    <TableHead>Taux effectif</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Jours</TableHead>
                    <TableHead className="text-right">Intérêts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultat.value.segments.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell>{formatDateFR(s.debut)} → {formatDateFR(s.fin)}</TableCell>
                      <TableCell>{s.tauxLegalBase.toString().replace(".", ",")} %</TableCell>
                      <TableCell>{s.multiplicateur}</TableCell>
                      <TableCell>{s.majorationPoints}</TableCell>
                      <TableCell>{s.tauxAnnuel.toString().replace(".", ",")} %</TableCell>
                      <TableCell className="text-right">{formatEuros(s.base)}</TableCell>
                      <TableCell className="text-right">{s.jours}</TableCell>
                      <TableCell className="text-right">{formatEuros(s.interets)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {resultat.value.capitalisations.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Capitalisations</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Intérêts incorporés</TableHead>
                        <TableHead className="text-right">Nouvelle base</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resultat.value.capitalisations.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell>{formatDateFR(c.date)}</TableCell>
                          <TableCell className="text-right">{formatEuros(c.interetsIncorpores)}</TableCell>
                          <TableCell className="text-right">{formatEuros(c.nouvelleBase)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex items-center justify-between border-t pt-3">
                <span className="font-display font-semibold">Total de la ligne</span>
                <span className="font-display font-semibold">{formatEuros(resultat.value.totalInterets)}</span>
              </div>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
