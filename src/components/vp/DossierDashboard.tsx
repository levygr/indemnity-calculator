/**
 * Tableau de bord synthétique du dossier : progression par section + rappel
 * de la part victime, avertissements et derniers chiffrages figés.
 */
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SECTION_GROUPS, pageHasData } from "@/lib/dossier/pageStatus";
import type { DossierData } from "@/lib/calculs/types";
import { calculerSynthese, collecterAvertissements, formatEuros } from "@/lib/calculs";
import { formatDateFR } from "@/lib/calculs/format";
import { listSnapshots } from "@/lib/dossiers.functions";
import { AlertTriangle, CheckCircle2, Circle, Camera } from "lucide-react";

export function DossierDashboard({
  dossierId,
  dossier,
}: {
  dossierId: string;
  dossier: DossierData;
}) {
  const synth = useMemo(() => calculerSynthese(dossier), [dossier]);
  const nbAvertissements = useMemo(
    () => collecterAvertissements(dossier).length,
    [dossier],
  );

  const fetchSnap = useServerFn(listSnapshots);
  const { data: snaps } = useQuery({
    queryKey: ["snapshots", dossierId],
    queryFn: () => fetchSnap({ data: { dossierId } }),
  });
  const derniers = (snaps ?? []).slice(0, 3);

  return (
    <section className="space-y-4" aria-label="Tableau de bord du dossier">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card className="border-primary/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-display uppercase tracking-wide text-muted-foreground">
              Part victime courante
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-display font-semibold tabular-nums text-success">
              {formatEuros(synth.totalVictime)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Solde après provisions : <span className="tabular-nums">{formatEuros(synth.soldeVictime)}</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-display uppercase tracking-wide text-muted-foreground">
              Contrôles de cohérence
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {nbAvertissements > 0 ? (
              <Link
                to="/dossiers/$id/synthese"
                params={{ id: dossierId }}
                hash="section-controles-coherence"
                className="flex items-center gap-2 text-destructive hover:underline"
              >
                <AlertTriangle className="w-5 h-5" />
                <span className="text-2xl font-display font-semibold tabular-nums">
                  {nbAvertissements}
                </span>
                <span className="text-xs text-muted-foreground">à examiner</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="w-5 h-5" />
                <span className="text-sm font-display font-medium">Aucune incohérence</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-display uppercase tracking-wide text-muted-foreground">
              Derniers chiffrages figés
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {derniers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun chiffrage figé.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {derniers.map((s) => {
                  const total = (s.synthese as unknown as { totalVictime?: number } | null)?.totalVictime;
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        <Camera className="inline w-3 h-3 mr-1 text-muted-foreground" aria-hidden="true" />
                        {s.nom}
                        <span className="text-muted-foreground ml-1">
                          ({formatDateFR(s.created_at.slice(0, 10))})
                        </span>
                      </span>
                      <span className="tabular-nums font-medium shrink-0">
                        {typeof total === "number" ? formatEuros(total) : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="sr-only">Progression des sections</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {SECTION_GROUPS.flatMap((g) => g.items).map((s) => {
            const has = pageHasData(s.key, dossier);
            return (
              <Link
                key={s.key}
                to={s.route}
                params={{ id: dossierId }}
                className="rounded-md border border-border bg-card hover:bg-muted/50 px-3 py-2 flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition"
              >
                <span className="text-xs font-display font-medium truncate">{s.label}</span>
                {has ? (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-display font-semibold shrink-0">
                    <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    Renseignée
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-display shrink-0">
                    <Circle className="w-3 h-3" aria-hidden="true" />
                    Vide
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
