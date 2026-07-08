/**
 * Affichage structuré et lisible des valeurs d'une édition de référentiel,
 * sur le modèle de l'écran « Taux légal » : de vraies tables, pas du JSON.
 *
 * - Lecture seule pour les éditions actives/archivées.
 * - Édition inline (brouillons uniquement) là où c'est sûr :
 *   fourchettes du référentiel Mornet et indices annuels/mensuels.
 * - Les grilles matricielles (PER, AIPP) restent en lecture visuelle ;
 *   leur modification passe par l'import CSV avec prévisualisation,
 *   déjà en place sur la page (diff cellule par cellule).
 *
 * AUCUNE VALEUR N'EST TRANSFORMÉE : ce composant ne fait qu'afficher et,
 * pour les zones éditables, réécrire exactement ce que l'utilisateur saisit.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { EditionRowItem } from "@/lib/referentiels/editions.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateFR, formatNombre } from "@/lib/calculs/format";
import { AlertTriangle, Check, ExternalLink, Info, Save } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Types locaux (miroir des payloads du registre)                            */
/* -------------------------------------------------------------------------- */

interface PerPayload {
  description: string;
  colonne_viagere: number;
  ages_fin_de_rente: number[];
  lignes: Array<{ age_liquidation: number; prix: number[] }>;
}

interface AippPayload {
  meta: { source: string; edition: string };
  tranchesTaux: Array<{ min: number; max: number; label: string }>;
  tranchesAge: Array<{ min: number; max: number; label: string }>;
  valeursPoint: number[][];
}

interface MortaliteLigne {
  age: number;
  ensemble_survivants: number;
  ensemble_quotient: number;
  ensemble_esperance: number;
  femmes_survivantes: number;
  femmes_quotient: number;
  femmes_esperance: number;
  hommes_survivants: number;
  hommes_quotient: number;
  hommes_esperance: number;
}

interface FourchetteDegre {
  degre: number;
  label: string;
  min: number | null;
  max: number | null;
}
interface FourchetteLien {
  code: string;
  label: string;
  min: number | null;
  max: number | null;
  note?: string;
}
interface EvaluationPayload {
  nom: string;
  edition: string;
  fourchettesDegre: {
    SE: FourchetteDegre[];
    PEP: FourchetteDegre[];
    PET: FourchetteDegre[] | null;
  };
  dftIndicatif: {
    parMoisMin: number;
    parMoisMax: number;
    parJourMin: number;
    parJourMax: number;
    note: string;
  };
  affectionDeces: FourchetteLien[];
}

export interface SaveRowInput {
  rowId?: string;
  cle: unknown;
  valeur: unknown;
  commentaire?: string | null;
}

interface Props {
  code: string;
  rows: EditionRowItem[];
  editable: boolean;
  saving: boolean;
  onSaveRow: (input: SaveRowInput) => void;
}

/** true si un rendu structuré existe pour ce code. */
export function hasStructuredView(code: string): boolean {
  return (
    code === "taux_legal" ||
    code === "indices_actualisation" ||
    code === "bareme_aipp" ||
    code === "referentiel_evaluation" ||
    code.startsWith("mortalite_") ||
    (code.startsWith("bareme_") && code.endsWith("_2025"))
  );
}

/* -------------------------------------------------------------------------- */
/*  Utilitaires                                                                */
/* -------------------------------------------------------------------------- */

function fullRow(rows: EditionRowItem[]): EditionRowItem | undefined {
  return rows.find((r) => r.cle && (r.cle as { type?: string }).type === "full");
}

function euros(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v.toLocaleString("fr-FR")} €`;
}

function parseNum(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function numToStr(v: number | null | undefined): string {
  return v == null ? "" : String(v).replace(".", ",");
}

const TH = "px-3 py-2 font-semibold text-left whitespace-nowrap";
const TD = "px-3 py-1.5 whitespace-nowrap";

/* -------------------------------------------------------------------------- */
/*  Composant principal                                                        */
/* -------------------------------------------------------------------------- */

export function ReferentielTables({ code, rows, editable, saving, onSaveRow }: Props) {
  if (code === "taux_legal") return <TauxLegalView rows={rows} />;
  if (code === "indices_actualisation")
    return <IndicesView rows={rows} editable={editable} saving={saving} onSaveRow={onSaveRow} />;
  if (code.startsWith("mortalite_")) return <MortaliteView rows={rows} />;
  if (code === "bareme_aipp") return <AippView rows={rows} editable={editable} />;
  if (code.startsWith("bareme_") && code.endsWith("_2025")) return <PerView rows={rows} editable={editable} />;
  if (code === "referentiel_evaluation")
    return <EvaluationView rows={rows} editable={editable} saving={saving} onSaveRow={onSaveRow} />;
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Taux légal (géré par son propre écran)                                     */
/* -------------------------------------------------------------------------- */

function TauxLegalView({ rows }: { rows: EditionRowItem[] }) {
  const periodes = useMemo(
    () =>
      rows
        .filter((r) => (r.cle as { debut?: string }).debut != null)
        .map((r) => ({
          debut: (r.cle as { debut: string }).debut,
          ...(r.valeur as {
            fin: string;
            tauxParticulier: number | null;
            tauxAutres: number | null;
            reference: string | null;
          }),
        }))
        .sort((a, b) => a.debut.localeCompare(b.debut)),
    [rows],
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Taux d'intérêt légal par semestre</CardTitle>
        <Button asChild size="sm" variant="outline">
          <Link to="/taux-legal">
            <ExternalLink className="w-3.5 h-3.5 mr-1" />
            Gérer depuis l'écran Taux légal
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted font-display">
              <tr>
                <th className={TH}>Période</th>
                <th className={`${TH} text-right`}>Taux particulier (%)</th>
                <th className={`${TH} text-right`}>Taux autres (%)</th>
                <th className={TH}>Référence de l'arrêté</th>
                <th className={TH}>État</th>
              </tr>
            </thead>
            <tbody>
              {periodes.map((p) => {
                const ok = p.tauxParticulier != null && p.tauxAutres != null;
                return (
                  <tr key={p.debut} className="border-t">
                    <td className={`${TD} font-medium`}>
                      {formatDateFR(p.debut)} → {formatDateFR(p.fin)}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {p.tauxParticulier == null ? "—" : formatNombre(p.tauxParticulier, 2)}
                    </td>
                    <td className={`${TD} text-right tabular-nums`}>
                      {p.tauxAutres == null ? "—" : formatNombre(p.tauxAutres, 2)}
                    </td>
                    <td className={`${TD} text-muted-foreground`}>{p.reference ?? "—"}</td>
                    <td className={TD}>
                      {ok ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                          <Check className="w-3.5 h-3.5" /> Renseigné
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" /> Manquant
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Indices IPC / SMIC (éditable ligne à ligne en brouillon)                   */
/* -------------------------------------------------------------------------- */

function IndicesView({
  rows,
  editable,
  saving,
  onSaveRow,
}: {
  rows: EditionRowItem[];
  editable: boolean;
  saving: boolean;
  onSaveRow: (input: SaveRowInput) => void;
}) {
  const annuels = useMemo(
    () =>
      rows
        .filter((r) => (r.cle as { type?: string }).type === "annuel")
        .sort((a, b) => ((a.cle as { annee: number }).annee ?? 0) - ((b.cle as { annee: number }).annee ?? 0)),
    [rows],
  );
  const mensuels = useMemo(() => rows.filter((r) => (r.cle as { type?: string }).type === "mensuel"), [rows]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Indices annuels (IPC et SMIC horaire brut)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted font-display">
                <tr>
                  <th className={TH}>Année</th>
                  <th className={`${TH} text-right`}>IPC</th>
                  <th className={`${TH} text-right`}>SMIC horaire brut (€)</th>
                  {editable && <th className={`${TH} w-0`}></th>}
                </tr>
              </thead>
              <tbody>
                {annuels.map((r) => (
                  <IndiceAnnuelRow key={r.id} row={r} editable={editable} saving={saving} onSaveRow={onSaveRow} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Indices mensuels (IPC)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted font-display">
                <tr>
                  <th className={TH}>Année</th>
                  <th className={TH}>Mois</th>
                  <th className={`${TH} text-right`}>IPC mensuel</th>
                  {editable && <th className={`${TH} w-0`}></th>}
                </tr>
              </thead>
              <tbody>
                {mensuels.map((r) => (
                  <IndiceMensuelRow key={r.id} row={r} editable={editable} saving={saving} onSaveRow={onSaveRow} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function IndiceAnnuelRow({
  row,
  editable,
  saving,
  onSaveRow,
}: {
  row: EditionRowItem;
  editable: boolean;
  saving: boolean;
  onSaveRow: (input: SaveRowInput) => void;
}) {
  const cle = row.cle as { type: string; annee: number };
  const v = row.valeur as { ipc: number; smic_horaire_brut: number };
  const [ipc, setIpc] = useState(numToStr(v.ipc));
  const [smic, setSmic] = useState(numToStr(v.smic_horaire_brut));
  useEffect(() => {
    setIpc(numToStr(v.ipc));
    setSmic(numToStr(v.smic_horaire_brut));
  }, [row.id, v.ipc, v.smic_horaire_brut]);

  const dirty = parseNum(ipc) !== v.ipc || parseNum(smic) !== v.smic_horaire_brut;

  if (!editable) {
    return (
      <tr className="border-t">
        <td className={`${TD} font-medium`}>{cle.annee}</td>
        <td className={`${TD} text-right tabular-nums`}>{formatNombre(v.ipc, 2)}</td>
        <td className={`${TD} text-right tabular-nums`}>{formatNombre(v.smic_horaire_brut, 2)}</td>
      </tr>
    );
  }
  return (
    <tr className="border-t">
      <td className={`${TD} font-medium`}>{cle.annee}</td>
      <td className={TD}>
        <Input value={ipc} onChange={(e) => setIpc(e.target.value)} className="h-8 text-right" inputMode="decimal" />
      </td>
      <td className={TD}>
        <Input value={smic} onChange={(e) => setSmic(e.target.value)} className="h-8 text-right" inputMode="decimal" />
      </td>
      <td className={TD}>
        <Button
          size="sm"
          variant={dirty ? "default" : "ghost"}
          disabled={!dirty || saving || parseNum(ipc) == null || parseNum(smic) == null}
          onClick={() =>
            onSaveRow({
              rowId: row.id,
              cle,
              valeur: { ipc: parseNum(ipc), smic_horaire_brut: parseNum(smic) },
              commentaire: row.commentaire,
            })
          }
        >
          <Save className="w-3.5 h-3.5 mr-1" />
          Enregistrer
        </Button>
      </td>
    </tr>
  );
}

function IndiceMensuelRow({
  row,
  editable,
  saving,
  onSaveRow,
}: {
  row: EditionRowItem;
  editable: boolean;
  saving: boolean;
  onSaveRow: (input: SaveRowInput) => void;
}) {
  const cle = row.cle as { type: string; annee: number; mois: string };
  const v = row.valeur as { ipc_mensuel: number };
  const [ipc, setIpc] = useState(numToStr(v.ipc_mensuel));
  useEffect(() => setIpc(numToStr(v.ipc_mensuel)), [row.id, v.ipc_mensuel]);
  const dirty = parseNum(ipc) !== v.ipc_mensuel;

  if (!editable) {
    return (
      <tr className="border-t">
        <td className={`${TD} font-medium`}>{cle.annee}</td>
        <td className={TD}>{cle.mois}</td>
        <td className={`${TD} text-right tabular-nums`}>{formatNombre(v.ipc_mensuel, 2)}</td>
      </tr>
    );
  }
  return (
    <tr className="border-t">
      <td className={`${TD} font-medium`}>{cle.annee}</td>
      <td className={TD}>{cle.mois}</td>
      <td className={TD}>
        <Input value={ipc} onChange={(e) => setIpc(e.target.value)} className="h-8 text-right" inputMode="decimal" />
      </td>
      <td className={TD}>
        <Button
          size="sm"
          variant={dirty ? "default" : "ghost"}
          disabled={!dirty || saving || parseNum(ipc) == null}
          onClick={() =>
            onSaveRow({
              rowId: row.id,
              cle,
              valeur: { ipc_mensuel: parseNum(ipc) },
              commentaire: row.commentaire,
            })
          }
        >
          <Save className="w-3.5 h-3.5 mr-1" />
          Enregistrer
        </Button>
      </td>
    </tr>
  );
}

/* -------------------------------------------------------------------------- */
/*  Tables de mortalité INSEE                                                  */
/* -------------------------------------------------------------------------- */

function MortaliteView({ rows }: { rows: EditionRowItem[] }) {
  const full = fullRow(rows);
  const lignes = (full?.valeur as unknown as MortaliteLigne[] | undefined) ?? [];
  if (!full || !Array.isArray(lignes)) return <PayloadIntrouvable />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Table de mortalité par âge (survivants, quotient de mortalité ‰, espérance de vie)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto border rounded-md max-h-[70vh]">
          <table className="w-full text-xs">
            <thead className="bg-muted font-display sticky top-0 z-10">
              <tr>
                <th className={`${TH} sticky left-0 bg-muted z-20`} rowSpan={2}>
                  Âge
                </th>
                <th className={`${TH} text-center border-l`} colSpan={3}>
                  Ensemble
                </th>
                <th className={`${TH} text-center border-l`} colSpan={3}>
                  Femmes
                </th>
                <th className={`${TH} text-center border-l`} colSpan={3}>
                  Hommes
                </th>
              </tr>
              <tr>
                <th className={`${TH} text-right border-l`}>Survivants</th>
                <th className={`${TH} text-right`}>Quotient</th>
                <th className={`${TH} text-right`}>Espérance</th>
                <th className={`${TH} text-right border-l`}>Survivantes</th>
                <th className={`${TH} text-right`}>Quotient</th>
                <th className={`${TH} text-right`}>Espérance</th>
                <th className={`${TH} text-right border-l`}>Survivants</th>
                <th className={`${TH} text-right`}>Quotient</th>
                <th className={`${TH} text-right`}>Espérance</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.age} className="border-t">
                  <td className={`${TD} font-medium sticky left-0 bg-card`}>{l.age}</td>
                  <td className={`${TD} text-right tabular-nums border-l`}>
                    {l.ensemble_survivants.toLocaleString("fr-FR")}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{l.ensemble_quotient.toLocaleString("fr-FR")}</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatNombre(l.ensemble_esperance, 2)}</td>
                  <td className={`${TD} text-right tabular-nums border-l`}>
                    {l.femmes_survivantes.toLocaleString("fr-FR")}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{l.femmes_quotient.toLocaleString("fr-FR")}</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatNombre(l.femmes_esperance, 2)}</td>
                  <td className={`${TD} text-right tabular-nums border-l`}>
                    {l.hommes_survivants.toLocaleString("fr-FR")}
                  </td>
                  <td className={`${TD} text-right tabular-nums`}>{l.hommes_quotient.toLocaleString("fr-FR")}</td>
                  <td className={`${TD} text-right tabular-nums`}>{formatNombre(l.hommes_esperance, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Barème PER (Gazette du Palais) — grille âges × âge de fin de rente         */
/* -------------------------------------------------------------------------- */

function PerView({ rows, editable }: { rows: EditionRowItem[]; editable: boolean }) {
  const full = fullRow(rows);
  const payload = full?.valeur as unknown as PerPayload | undefined;
  const [filtreAge, setFiltreAge] = useState("");

  const lignes = useMemo(() => {
    if (!payload) return [];
    const f = filtreAge.trim();
    if (f === "") return payload.lignes;
    const n = Number(f);
    if (!Number.isFinite(n)) return payload.lignes;
    return payload.lignes.filter((l) => l.age_liquidation === n);
  }, [payload, filtreAge]);

  if (!full || !payload?.lignes) return <PayloadIntrouvable />;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle className="text-base">Prix de l'euro de rente (PER)</CardTitle>
        <p className="text-xs text-muted-foreground">{payload.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={filtreAge}
            onChange={(e) => setFiltreAge(e.target.value)}
            placeholder="Filtrer : âge à la liquidation"
            className="h-8 w-56"
            inputMode="numeric"
          />
          {editable && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              Grille modifiable via l'import CSV ci-dessus (diff cellule par cellule).
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto border rounded-md max-h-[70vh]">
          <table className="text-xs">
            <thead className="bg-muted font-display sticky top-0 z-10">
              <tr>
                <th className={`${TH} sticky left-0 bg-muted z-20`}>Âge liquid. ↓ / fin de rente →</th>
                {payload.ages_fin_de_rente.map((a) => (
                  <th key={a} className={`${TH} text-right`}>
                    {a}
                  </th>
                ))}
                <th className={`${TH} text-right border-l bg-primary/10`}>Viagère</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.age_liquidation} className="border-t">
                  <td className={`${TD} font-medium sticky left-0 bg-card`}>{l.age_liquidation}</td>
                  {l.prix.slice(0, payload.ages_fin_de_rente.length).map((p, j) => (
                    <td key={j} className={`${TD} text-right tabular-nums`}>
                      {formatNombre(p, 3)}
                    </td>
                  ))}
                  <td className={`${TD} text-right tabular-nums border-l bg-primary/5 font-medium`}>
                    {formatNombre(l.prix[payload.ages_fin_de_rente.length], 3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Barème du point AIPP (Mornet)                                              */
/* -------------------------------------------------------------------------- */

function AippView({ rows, editable }: { rows: EditionRowItem[]; editable: boolean }) {
  const full = fullRow(rows);
  const payload = full?.valeur as unknown as AippPayload | undefined;
  if (!full || !payload?.valeursPoint) return <PayloadIntrouvable />;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Valeur du point d'AIPP (€)</CardTitle>
        <p className="text-xs text-muted-foreground">
          {payload.meta.source} — édition {payload.meta.edition}. Lignes : taux d'AIPP (%). Colonnes : âge à la
          consolidation.
        </p>
        {editable && (
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            Grille modifiable via l'import CSV ci-dessus (diff cellule par cellule).
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted font-display">
              <tr>
                <th className={`${TH} sticky left-0 bg-muted`}>Taux ↓ / Âge →</th>
                {payload.tranchesAge.map((t) => (
                  <th key={t.label} className={`${TH} text-right`}>
                    {t.label} ans
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payload.tranchesTaux.map((t, i) => (
                <tr key={t.label} className="border-t">
                  <td className={`${TD} font-medium sticky left-0 bg-card`}>{t.label} %</td>
                  {payload.tranchesAge.map((_, j) => (
                    <td key={j} className={`${TD} text-right tabular-nums`}>
                      {payload.valeursPoint[i]?.[j]?.toLocaleString("fr-FR") ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Référentiel Mornet (fourchettes) — éditable en brouillon                   */
/* -------------------------------------------------------------------------- */

function EvaluationView({
  rows,
  editable,
  saving,
  onSaveRow,
}: {
  rows: EditionRowItem[];
  editable: boolean;
  saving: boolean;
  onSaveRow: (input: SaveRowInput) => void;
}) {
  const full = fullRow(rows);
  const initial = full?.valeur as unknown as EvaluationPayload | undefined;
  const [draft, setDraft] = useState<EvaluationPayload | null>(null);

  useEffect(() => {
    setDraft(initial ? (JSON.parse(JSON.stringify(initial)) as EvaluationPayload) : null);
  }, [full?.id]);

  if (!full || !initial || !draft) return <PayloadIntrouvable />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const save = () => onSaveRow({ rowId: full.id, cle: { type: "full" }, valeur: draft, commentaire: full.commentaire });

  const setDegre = (poste: "SE" | "PEP", index: number, champ: "min" | "max", val: number | null) => {
    setDraft((d) => {
      if (!d) return d;
      const next = JSON.parse(JSON.stringify(d)) as EvaluationPayload;
      next.fourchettesDegre[poste][index][champ] = val;
      return next;
    });
  };
  const setAffection = (index: number, champ: "min" | "max", val: number | null) => {
    setDraft((d) => {
      if (!d) return d;
      const next = JSON.parse(JSON.stringify(d)) as EvaluationPayload;
      next.affectionDeces[index][champ] = val;
      return next;
    });
  };
  const setDft = (champ: "parMoisMin" | "parMoisMax" | "parJourMin" | "parJourMax", val: number | null) => {
    if (val == null) return;
    setDraft((d) => {
      if (!d) return d;
      const next = JSON.parse(JSON.stringify(d)) as EvaluationPayload;
      next.dftIndicatif[champ] = val;
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {draft.nom} — édition {draft.edition}. Fourchettes strictement indicatives.
        </p>
        {editable && (
          <Button size="sm" disabled={!dirty || saving} onClick={save}>
            <Save className="w-3.5 h-3.5 mr-1" />
            Enregistrer les modifications
          </Button>
        )}
      </div>

      <GrilleDegre
        titre="Souffrances endurées (SE)"
        grille={draft.fourchettesDegre.SE}
        editable={editable}
        onChange={(i, c, v) => setDegre("SE", i, c, v)}
      />
      <GrilleDegre
        titre="Préjudice esthétique permanent (PEP)"
        grille={draft.fourchettesDegre.PEP}
        editable={editable}
        onChange={(i, c, v) => setDegre("PEP", i, c, v)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Préjudice esthétique temporaire (PET)</CardTitle>
        </CardHeader>
        <CardContent>
          {draft.fourchettesDegre.PET === null ? (
            <Alert>
              <Info className="w-4 h-4" />
              <AlertTitle>Aucune grille publiée</AlertTitle>
              <AlertDescription>
                Le référentiel ne publie pas de grille chiffrée pour ce poste : il s'apprécie in concreto. Aucune
                fourchette n'est proposée, à dessein.
              </AlertDescription>
            </Alert>
          ) : (
            <GrilleDegreTable grille={draft.fourchettesDegre.PET} editable={false} onChange={() => {}} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Déficit fonctionnel temporaire (repère indicatif, DFT total)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted font-display">
                <tr>
                  <th className={TH}>Base</th>
                  <th className={`${TH} text-right`}>Minimum (€)</th>
                  <th className={`${TH} text-right`}>Maximum (€)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t">
                  <td className={`${TD} font-medium`}>Par mois</td>
                  <CelluleMontant
                    editable={editable}
                    value={draft.dftIndicatif.parMoisMin}
                    onChange={(v) => setDft("parMoisMin", v)}
                  />
                  <CelluleMontant
                    editable={editable}
                    value={draft.dftIndicatif.parMoisMax}
                    onChange={(v) => setDft("parMoisMax", v)}
                  />
                </tr>
                <tr className="border-t">
                  <td className={`${TD} font-medium`}>Par jour</td>
                  <CelluleMontant
                    editable={editable}
                    value={draft.dftIndicatif.parJourMin}
                    onChange={(v) => setDft("parJourMin", v)}
                  />
                  <CelluleMontant
                    editable={editable}
                    value={draft.dftIndicatif.parJourMax}
                    onChange={(v) => setDft("parJourMax", v)}
                  />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">{draft.dftIndicatif.note}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Préjudice d'affection en cas de décès</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted font-display">
                <tr>
                  <th className={TH}>Lien avec le défunt</th>
                  <th className={`${TH} text-right`}>Minimum (€)</th>
                  <th className={`${TH} text-right`}>Maximum (€)</th>
                  <th className={TH}>Note</th>
                </tr>
              </thead>
              <tbody>
                {draft.affectionDeces.map((f, i) => (
                  <tr key={f.code} className="border-t align-top">
                    <td className={`${TD} font-medium whitespace-normal`}>{f.label}</td>
                    <CelluleMontant
                      editable={editable}
                      value={f.min}
                      onChange={(v) => setAffection(i, "min", v)}
                      nullable
                    />
                    <CelluleMontant
                      editable={editable}
                      value={f.max}
                      onChange={(v) => setAffection(i, "max", v)}
                      nullable
                    />
                    <td className={`${TD} whitespace-normal text-xs text-muted-foreground`}>{f.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editable && dirty && (
        <div className="flex justify-end">
          <Button disabled={saving} onClick={save}>
            <Save className="w-4 h-4 mr-1" />
            Enregistrer les modifications
          </Button>
        </div>
      )}
    </div>
  );
}

function GrilleDegre({
  titre,
  grille,
  editable,
  onChange,
}: {
  titre: string;
  grille: FourchetteDegre[];
  editable: boolean;
  onChange: (index: number, champ: "min" | "max", val: number | null) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titre}</CardTitle>
      </CardHeader>
      <CardContent>
        <GrilleDegreTable grille={grille} editable={editable} onChange={onChange} />
      </CardContent>
    </Card>
  );
}

function GrilleDegreTable({
  grille,
  editable,
  onChange,
}: {
  grille: FourchetteDegre[];
  editable: boolean;
  onChange: (index: number, champ: "min" | "max", val: number | null) => void;
}) {
  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-sm">
        <thead className="bg-muted font-display">
          <tr>
            <th className={TH}>Cotation</th>
            <th className={`${TH} text-right`}>Minimum (€)</th>
            <th className={`${TH} text-right`}>Maximum (€)</th>
          </tr>
        </thead>
        <tbody>
          {grille.map((f, i) => (
            <tr key={f.degre} className="border-t">
              <td className={`${TD} font-medium`}>{f.label}</td>
              <CelluleMontant editable={editable} value={f.min} onChange={(v) => onChange(i, "min", v)} nullable />
              <CelluleMontant editable={editable} value={f.max} onChange={(v) => onChange(i, "max", v)} nullable />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CelluleMontant({
  editable,
  value,
  onChange,
  nullable = false,
}: {
  editable: boolean;
  value: number | null;
  onChange: (v: number | null) => void;
  nullable?: boolean;
}) {
  const [text, setText] = useState(numToStr(value));
  useEffect(() => setText(numToStr(value)), [value]);

  if (!editable) {
    return <td className={`${TD} text-right tabular-nums`}>{euros(value)}</td>;
  }
  return (
    <td className={TD}>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = parseNum(text);
          if (n == null && !nullable) {
            setText(numToStr(value));
            return;
          }
          onChange(n);
        }}
        placeholder={nullable ? "—" : ""}
        className="h-8 text-right"
        inputMode="decimal"
      />
    </td>
  );
}

/* -------------------------------------------------------------------------- */

function PayloadIntrouvable() {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="w-4 h-4" />
      <AlertTitle>Structure inattendue</AlertTitle>
      <AlertDescription>
        Les valeurs de cette édition n'ont pas la structure attendue pour un affichage en table. Utilisez la vue avancée
        (JSON) ci-dessous.
      </AlertDescription>
    </Alert>
  );
}
