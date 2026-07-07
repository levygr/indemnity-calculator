import { createFileRoute } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useDossier } from "@/hooks/useDossier";
import { Note, Section } from "@/components/vp/Field";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { calculerSynthese, CATEGORIE_LABEL, formatEuros, type Categorie } from "@/lib/calculs";
import type { Synthese, LigneSynthese } from "@/lib/calculs/postes/synthese";
import { listSnapshots, getSnapshot } from "@/lib/dossiers.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dossiers/$id/comparateur")({
  component: Page,
});

const ORDRE: Categorie[] = ["PT", "EPT", "PP", "EPP", "DECES", "SURVIE"];
const COURANT = "__courant__";
const AUCUN = "__aucun__";

interface Colonne {
  key: string;
  label: string;
  synth: Synthese;
}

function Page() {
  const { id } = Route.useParams();
  const { dossier } = useDossier(id);
  const list = useServerFn(listSnapshots);
  const get = useServerFn(getSnapshot);

  const syntheseCourante = useMemo(
    () => (dossier ? calculerSynthese(dossier) : null),
    [dossier],
  );

  const { data: snapshots = [] } = useQuery({
    queryKey: ["snapshots", id],
    queryFn: () => list({ data: { dossierId: id } }),
  });

  // Sélection : trois emplacements, valeur = key ("__courant__", "__aucun__" ou snapshot id)
  const [sel, setSel] = useState<[string, string, string]>([COURANT, AUCUN, AUCUN]);

  // Charger les snapshots sélectionnés (pour obtenir la synthese complète)
  const selectedIds = useMemo(
    () => sel.filter((s) => s !== COURANT && s !== AUCUN),
    [sel],
  );

  const snapshotQueries = selectedIds.map((sid) => ({
    sid,
    q: useQuery({
      queryKey: ["snapshot", sid],
      queryFn: () => get({ data: { id: sid } }),
    }),
  }));

  const colonnes: Colonne[] = useMemo(() => {
    const res: Colonne[] = [];
    for (const s of sel) {
      if (s === AUCUN) continue;
      if (s === COURANT) {
        if (syntheseCourante) res.push({ key: COURANT, label: "Chiffrage courant", synth: syntheseCourante });
      } else {
        const snap = snapshots.find((x) => x.id === s);
        const full = snapshotQueries.find((q) => q.sid === s)?.q.data;
        if (full) {
          res.push({
            key: s,
            label: snap?.nom ?? "Chiffrage figé",
            synth: full.synthese as unknown as Synthese,
          });
        }
      }
    }
    return res;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, syntheseCourante, snapshots, snapshotQueries.map((q) => q.q.data).join("|")]);

  if (!dossier || !syntheseCourante) return null;

  // Ordonnancement des lignes : préserver l'ordre de la première colonne, puis ajouter
  // les codes présents dans les autres colonnes non encore vus.
  const lignesParCategorie = useMemo(() => {
    const map: Record<Categorie, Array<{ code: string; poste: string }>> = {
      PT: [], EPT: [], PP: [], EPP: [], DECES: [], SURVIE: [],
    };
    const seen = new Set<string>();
    for (const col of colonnes) {
      for (const l of col.synth.lignes) {
        if (seen.has(l.code)) continue;
        seen.add(l.code);
        map[l.categorie].push({ code: l.code, poste: l.poste });
      }
    }
    return map;
  }, [colonnes]);

  function ligneOf(col: Colonne, code: string): LigneSynthese | undefined {
    return col.synth.lignes.find((l) => l.code === code);
  }

  const options = [
    { value: COURANT, label: "Chiffrage courant" },
    ...snapshots.map((s) => ({
      value: s.id,
      label: `${s.nom} — ${new Date(s.created_at).toLocaleDateString("fr-FR")}`,
    })),
  ];

  const nbColsSelectionnees = colonnes.length;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <header>
        <div className="text-xs font-display font-semibold text-primary tracking-wide">
          COMPARATEUR
        </div>
        <h1 className="mt-1 text-2xl font-display font-semibold">
          Comparaison de chiffrages du dossier {dossier.reference}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sélectionnez 2 ou 3 chiffrages à comparer. Les écarts sont calculés
          entre la première colonne et chacune des autres, sur la part revenant
          à la victime.
        </p>
        <Note>
          Cas d'usage type : comparer la réclamation du cabinet (chiffrage
          courant ou snapshot dédié) à l'offre de l'assureur reconstituée dans
          un snapshot nommé « Offre adverse ».
        </Note>
      </header>

      <Section title="Chiffrages comparés">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1">
              <div className="text-xs font-display text-muted-foreground">
                Colonne {i + 1}{i === 0 ? " (référence)" : ""}
              </div>
              <Select
                value={sel[i]}
                onValueChange={(v) =>
                  setSel((prev) => {
                    const next = [...prev] as [string, string, string];
                    next[i] = v;
                    return next;
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {i > 0 && <SelectItem value={AUCUN}>— Aucun —</SelectItem>}
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        {nbColsSelectionnees < 2 && (
          <div className="mt-3 text-sm text-muted-foreground">
            Sélectionnez au moins 2 chiffrages pour afficher le tableau comparatif.
          </div>
        )}
      </Section>

      {nbColsSelectionnees >= 2 && (
        <Section title="Comparaison poste par poste (part victime)">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[280px]">Poste</TableHead>
                  {colonnes.map((c) => (
                    <TableHead key={c.key} className="text-right">{c.label}</TableHead>
                  ))}
                  {colonnes.slice(1).map((c) => (
                    <TableHead key={`ec-${c.key}`} className="text-right" colSpan={2}>
                      Écart vs « {colonnes[0].label} »
                    </TableHead>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead></TableHead>
                  {colonnes.map((c) => (
                    <TableHead key={`h-${c.key}`}></TableHead>
                  ))}
                  {colonnes.slice(1).map((c) => (
                    <>
                      <TableHead key={`eu-${c.key}`} className="text-right text-[11px] text-muted-foreground">€</TableHead>
                      <TableHead key={`pc-${c.key}`} className="text-right text-[11px] text-muted-foreground">%</TableHead>
                    </>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ORDRE.map((cat) => {
                  const lignes = lignesParCategorie[cat];
                  if (lignes.length === 0) return null;
                  const sousTotaux = colonnes.map((c) =>
                    c.synth.sousTotaux.find((x) => x.categorie === cat)?.partVictime ?? 0,
                  );
                  const catNonNulle = sousTotaux.some((v) => v !== 0);
                  if (!catNonNulle) return null;
                  return (
                    <>
                      <TableRow key={`cat-${cat}`} className="bg-muted/60">
                        <TableCell
                          colSpan={1 + colonnes.length + (colonnes.length - 1) * 2}
                          className="font-display font-semibold text-xs uppercase tracking-wide"
                        >
                          {CATEGORIE_LABEL[cat]}
                        </TableCell>
                      </TableRow>
                      {lignes.map(({ code, poste }) => {
                        const valeurs = colonnes.map((c) => ligneOf(c, code)?.partVictime ?? 0);
                        if (valeurs.every((v) => v === 0)) return null;
                        return (
                          <TableRow key={code}>
                            <TableCell>
                              <span className="text-xs text-muted-foreground mr-2">{code}</span>
                              {poste}
                            </TableCell>
                            {valeurs.map((v, i) => (
                              <TableCell key={i} className="text-right tabular-nums">{formatEuros(v)}</TableCell>
                            ))}
                            {valeurs.slice(1).map((v, i) => (
                              <EcartCells key={`e-${i}`} ref={valeurs[0]} val={v} />
                            ))}
                          </TableRow>
                        );
                      })}
                      <TableRow key={`st-${cat}`} className="font-semibold bg-muted/30">
                        <TableCell>Sous-total {CATEGORIE_LABEL[cat]}</TableCell>
                        {sousTotaux.map((v, i) => (
                          <TableCell key={i} className="text-right tabular-nums">{formatEuros(v)}</TableCell>
                        ))}
                        {sousTotaux.slice(1).map((v, i) => (
                          <EcartCells key={`est-${i}`} ref={sousTotaux[0]} val={v} />
                        ))}
                      </TableRow>
                    </>
                  );
                })}

                <TotalRow
                  label="Part victime (avant provisions)"
                  values={colonnes.map((c) => c.synth.totalVictime)}
                  colonnes={colonnes}
                />
                <TotalRow
                  label="Provisions versées"
                  values={colonnes.map((c) => -c.synth.totalProvisions)}
                  colonnes={colonnes}
                  muted
                />
                <TotalRow
                  label="Solde revenant à la victime"
                  values={colonnes.map((c) => c.synth.soldeVictime)}
                  colonnes={colonnes}
                  strong
                />
              </TableBody>
            </Table>
          </div>
        </Section>
      )}
    </div>
  );
}

function EcartCells({ ref, val }: { ref: number; val: number }) {
  const diff = val - ref;
  const pct = ref === 0 ? null : (diff / ref) * 100;
  const color = diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-success" : "text-destructive";
  const sign = diff > 0 ? "+" : "";
  return (
    <>
      <TableCell className={cn("text-right tabular-nums", color)}>
        {diff === 0 ? "—" : `${sign}${formatEuros(diff)}`}
      </TableCell>
      <TableCell className={cn("text-right tabular-nums text-xs", color)}>
        {pct === null ? "—" : `${sign}${pct.toFixed(1)} %`}
      </TableCell>
    </>
  );
}

function TotalRow({
  label, values, colonnes, muted, strong,
}: {
  label: string;
  values: number[];
  colonnes: Colonne[];
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <TableRow className={cn(
      strong && "border-t-2 border-primary/40 bg-primary/5 font-display font-semibold text-base",
      muted && "text-muted-foreground",
      !strong && !muted && "font-semibold",
    )}>
      <TableCell>{label}</TableCell>
      {values.map((v, i) => (
        <TableCell key={i} className="text-right tabular-nums">{formatEuros(v)}</TableCell>
      ))}
      {values.slice(1).map((v, i) => (
        <EcartCells key={`t-${i}`} ref={values[0]} val={v} />
      ))}
      {/* Fill placeholder to satisfy column count if only 1 comparison column */}
      {colonnes.length === 2 ? null : null}
    </TableRow>
  );
}
